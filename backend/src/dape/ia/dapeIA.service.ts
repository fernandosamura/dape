import { QueryTypes } from "sequelize";
import cron from "node-cron";
import sequelize from "../../database";
import { SUMMARY_PROMPT, SUGGEST_REPLY_PROMPT, NEXT_ACTION_PROMPT } from "./dapeIA.prompts";
import { callAIProvider, AIProvider, AIMessage } from "../../services/AIProviderService/AIProviderRouter";
import nodeFs from "fs";
import fsPath from "path";
import axios from "axios";

const MAX_CALLS_PER_MINUTE = 50;
const DEFAULT_MODEL = "gpt-4o-mini";

// Cleanup diário: remove rate_limits com mais de 7 dias para evitar crescimento indefinido
cron.schedule("0 4 * * *", async () => {
  try {
    await sequelize.query(
      `DELETE FROM dape_ia_rate_limits WHERE window_start < NOW() - INTERVAL '7 days'`,
      { type: QueryTypes.DELETE }
    );
  } catch (_) {}
});

// ── Rate limiting ────────────────────────────────────────────────────────────

async function checkRateLimit(companyId: number): Promise<void> {
  const windowStart = new Date();
  windowStart.setSeconds(0, 0);

  const result = await sequelize.query<{ call_count: number }>(
    `INSERT INTO dape_ia_rate_limits (company_id, window_start, call_count)
     VALUES (:companyId, :windowStart, 1)
     ON CONFLICT (company_id, window_start)
     DO UPDATE SET call_count = dape_ia_rate_limits.call_count + 1
     RETURNING call_count`,
    { replacements: { companyId, windowStart }, type: QueryTypes.SELECT }
  );

  const count = Number(result[0]?.call_count || 1);
  if (count > MAX_CALLS_PER_MINUTE) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }
}

// ── AI client (multi-provider) ───────────────────────────────────────────────

interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

async function getCompanyAISettings(companyId: number): Promise<AISettings> {
  const rows = await sequelize.query<{ key: string; value: string }>(
    `SELECT key, value FROM "Settings" WHERE "companyId" = :companyId`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );
  const get = (key: string) => rows.find(r => r.key === key)?.value;

  const provider = (get("aiProvider") || "openai") as AIProvider;
  const model = get("aiModel") || DEFAULT_MODEL;

  let apiKey: string;
  switch (provider) {
    case "anthropic": apiKey = get("anthropicApiKey") || process.env.ANTHROPIC_API_KEY || ""; break;
    case "gemini":    apiKey = get("geminiApiKey")    || process.env.GEMINI_API_KEY    || ""; break;
    case "manus":     apiKey = get("manusApiKey")     || process.env.MANUS_API_KEY     || ""; break;
    default:
      apiKey = get("openaiApiKey") || get("OPENAI_API_KEY") || get("openai_api_key")
               || process.env.OPENAI_API_KEY || "";
  }

  const baseUrl = provider === "manus" ? (get("manusBaseUrl") || undefined) : undefined;

  if (!apiKey) throw new Error(`API_KEY_NOT_CONFIGURED:${provider}`);

  return { provider, model, apiKey, baseUrl };
}

async function callAI(companyId: number, prompt: string): Promise<{ content: string; tokens: number }> {
  const settings = await getCompanyAISettings(companyId);

  let content: string;
  try {
    content = await callAIProvider({
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 600,
      temperature: 0.7,
      baseUrl: settings.baseUrl,
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    // Re-throw rate limit and config errors so callers can handle them
    if (msg.includes('RATE_LIMIT') || msg.includes('API_KEY') || msg.includes('429')) {
      throw err;
    }
    // For transient provider errors (5xx, timeout, etc.) throw a typed error
    throw new Error('IA_PROVIDER_ERROR:' + settings.provider + '::' + msg.slice(0, 120));
  }

  // Token counting is only precise for OpenAI; for other providers we estimate
  const tokens = Math.ceil(content.length / 4);
  return { content, tokens };
}

function parseJSON(text: string): any {
  try {
    // Strip markdown code fences if present
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// ── Ticket message fetcher ───────────────────────────────────────────────────

async function getTicketMessages(ticketId: number, companyId: number): Promise<string> {
  const messages = await sequelize.query<{ body: string; fromMe: boolean; createdAt: Date }>(
    `SELECT body, "fromMe", "createdAt"
     FROM "Messages"
     WHERE "ticketId" = :ticketId AND "companyId" = :companyId
       AND "isDeleted" = false AND body IS NOT NULL AND body != ''
     ORDER BY "createdAt" ASC
     LIMIT 60`,
    { replacements: { ticketId, companyId }, type: QueryTypes.SELECT }
  );

  if (messages.length === 0) return "Sem mensagens registradas.";

  return messages
    .map((m) => `[${m.fromMe ? "Atendente" : "Cliente"}]: ${m.body}`)
    .join("\n");
}

// ── Public service functions ─────────────────────────────────────────────────

export async function summarizeTicket(ticketId: number, companyId: number) {
  await checkRateLimit(companyId);

  // Get ticket info
  const ticketInfo = await sequelize.query<{ contactId: number }>(
    `SELECT "contactId" FROM "Tickets" WHERE id = :ticketId AND "companyId" = :companyId`,
    { replacements: { ticketId, companyId }, type: QueryTypes.SELECT }
  );
  if (!ticketInfo[0]) throw new Error("TICKET_NOT_FOUND");

  const contactId = ticketInfo[0].contactId;
  const conversation = await getTicketMessages(ticketId, companyId);
  const prompt = SUMMARY_PROMPT(conversation);

  let content: string;
  let tokens: number;
  try {
    ({ content, tokens } = await callAI(companyId, prompt));
  } catch (err: any) {
    const msg = err?.message || "";
    if (msg.startsWith('IA_PROVIDER_ERROR')) {
      throw new Error('IA_PROVIDER_UNAVAILABLE');
    }
    throw err;
  }
  const parsed = parseJSON(content);

  if (!parsed) throw new Error('IA_PARSE_ERROR');

  // Save to DB
  const saved = await sequelize.query<{ id: number }>(
    `INSERT INTO dape_ia_summaries
       (ticket_id, contact_id, company_id, summary_text, next_action, sentiment, intent, urgency, estimated_value, model_used, tokens_used)
     VALUES (:ticketId, :contactId, :companyId, :summaryText, :nextAction, :sentiment, :intent, :urgency, :estimatedValue, :model, :tokens)
     RETURNING id`,
    {
      replacements: {
        ticketId, contactId, companyId,
        summaryText: parsed.resumo || content,
        nextAction: parsed.proxima_acao || null,
        sentiment: parsed.sentimento || null,
        intent: parsed.intencao || null,
        urgency: parsed.urgencia || null,
        estimatedValue: parsed.valor_estimado || null,
        model: DEFAULT_MODEL,
        tokens,
      },
      type: QueryTypes.SELECT,
    }
  );

  return {
    id: saved[0].id,
    ticketId,
    summary: parsed.resumo,
    nextAction: parsed.proxima_acao,
    sentiment: parsed.sentimento,
    intent: parsed.intencao,
    urgency: parsed.urgencia,
    estimatedValue: parsed.valor_estimado,
    tokensUsed: tokens,
  };
}

export async function getLatestSummary(ticketId: number, companyId: number) {
  const result = await sequelize.query(
    `SELECT * FROM dape_ia_summaries
     WHERE ticket_id = :ticketId AND company_id = :companyId
     ORDER BY generated_at DESC LIMIT 1`,
    { replacements: { ticketId, companyId }, type: QueryTypes.SELECT }
  );
  return result[0] || null;
}

export async function suggestReply(ticketId: number, companyId: number) {
  await checkRateLimit(companyId);

  const conversation = await getTicketMessages(ticketId, companyId);

  // Get last client message
  const lastMsg = await sequelize.query<{ body: string }>(
    `SELECT body FROM "Messages"
     WHERE "ticketId" = :ticketId AND "companyId" = :companyId AND "fromMe" = false AND "isDeleted" = false
     ORDER BY "createdAt" DESC LIMIT 1`,
    { replacements: { ticketId, companyId }, type: QueryTypes.SELECT }
  );
  const lastMessage = lastMsg[0]?.body || "Sem mensagem recente do cliente.";

  // Get latest summary for context
  const latestSummary = await getLatestSummary(ticketId, companyId) as any;
  const summaryContext = latestSummary?.summary_text || "Conversa em andamento.";

  const prompt = SUGGEST_REPLY_PROMPT(summaryContext, lastMessage);
  const { content, tokens } = await callAI(companyId, prompt);
  const parsed = parseJSON(content);
  if (!parsed?.opcoes) throw new Error("IA_PARSE_ERROR");

  // Save suggestions
  for (const text of parsed.opcoes) {
    await sequelize.query(
      `INSERT INTO dape_ia_suggestions (ticket_id, company_id, suggestion_type, suggestion_text)
       VALUES (:ticketId, :companyId, 'resposta', :text)`,
      { replacements: { ticketId, companyId, text }, type: QueryTypes.INSERT }
    );
  }

  return {
    ticketId,
    suggestions: parsed.opcoes,
    lastMessage,
    tokensUsed: tokens,
  };
}

export async function suggestNextAction(ticketId: number, companyId: number) {
  await checkRateLimit(companyId);

  const conversation = await getTicketMessages(ticketId, companyId);
  const latestSummary = await getLatestSummary(ticketId, companyId) as any;
  const summaryContext = latestSummary?.summary_text || "Lead em acompanhamento.";

  const prompt = NEXT_ACTION_PROMPT(summaryContext, conversation.split("\n").slice(-10).join("\n"));
  const { content, tokens } = await callAI(companyId, prompt);
  const parsed = parseJSON(content);
  if (!parsed) throw new Error("IA_PARSE_ERROR");

  await sequelize.query(
    `INSERT INTO dape_ia_suggestions (ticket_id, company_id, suggestion_type, suggestion_text)
     VALUES (:ticketId, :companyId, 'acao', :text)`,
    {
      replacements: { ticketId, companyId, text: JSON.stringify(parsed) },
      type: QueryTypes.INSERT,
    }
  );

  return {
    ticketId,
    action: parsed.acao,
    deadline: parsed.prazo,
    channel: parsed.canal,
    justification: parsed.justificativa,
    tokensUsed: tokens,
  };
}

export async function markSuggestionUsed(suggestionId: number, companyId: number): Promise<void> {
  await sequelize.query(
    `UPDATE dape_ia_suggestions SET was_used = true, used_at = NOW()
     WHERE id = :suggestionId AND company_id = :companyId`,
    { replacements: { suggestionId, companyId }, type: QueryTypes.UPDATE }
  );
}


// ── TTS Audio Generation ─────────────────────────────────────────────────────

export async function generateAudioReply(companyId: number, ticketId: number, text: string): Promise<string> {
  // Get OpenAI API key (TTS only works with OpenAI)
  const rows = await sequelize.query<{ key: string; value: string }>(
    `SELECT key, value FROM "Settings" WHERE "companyId" = :companyId`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );
  const get = (key: string) => rows.find(r => r.key === key)?.value;
  const apiKey = get("openaiApiKey") || get("OPENAI_API_KEY") || get("openai_api_key") || process.env.OPENAI_API_KEY || "";

  if (!apiKey) throw new Error("OPENAI_KEY_NOT_CONFIGURED");

  // Ensure audio directory exists
  const publicFolder = fsPath.resolve(__dirname, "..", "..", "..", "public");
  const audioFolder = fsPath.join(publicFolder, "audio");
  if (!nodeFs.existsSync(audioFolder)) {
    nodeFs.mkdirSync(audioFolder, { recursive: true });
  }

  const filename = `audio_${companyId}_${Date.now()}.mp3`;
  const filePath = fsPath.join(audioFolder, filename);

  // Call OpenAI TTS API directly via axios (openai v3.3.0 doesn't have audio.speech)
  const response = await axios.post(
    "https://api.openai.com/v1/audio/speech",
    { model: "tts-1", voice: "alloy", input: text },
    {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      responseType: "arraybuffer",
      timeout: 30_000,
    }
  );

  nodeFs.writeFileSync(filePath, Buffer.from(response.data));

  // Return public URL: served at /public/audio/<filename>
  const backendUrl = process.env.API_URL || "http://2.25.196.154:3000";
  return `${backendUrl}/public/audio/${filename}`;
}
