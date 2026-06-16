import { QueryTypes } from "sequelize";
import { Configuration, OpenAIApi } from "openai";
import sequelize from "../../database";
import { SUMMARY_PROMPT, SUGGEST_REPLY_PROMPT, NEXT_ACTION_PROMPT } from "./dapeIA.prompts";

const MAX_CALLS_PER_MINUTE = 10;
const MODEL = "gpt-4o-mini";

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

// ── OpenAI client ────────────────────────────────────────────────────────────

async function getOpenAIKey(companyId: number): Promise<string> {
  // 1. Try Settings table (key = 'openaiApiKey' or 'OPENAI_API_KEY')
  const setting = await sequelize.query<{ value: string }>(
    `SELECT value FROM "Settings"
     WHERE "companyId" = :companyId AND key IN ('openaiApiKey','OPENAI_API_KEY','openai_api_key')
     LIMIT 1`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );
  if (setting[0]?.value) return setting[0].value;

  // 2. Fallback to environment variable
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return envKey;

  throw new Error("OPENAI_KEY_NOT_CONFIGURED");
}

async function callOpenAI(companyId: number, prompt: string): Promise<{ content: string; tokens: number }> {
  const apiKey = await getOpenAIKey(companyId);
  const configuration = new Configuration({ apiKey });
  const openai = new OpenAIApi(configuration);

  const response = await openai.createChatCompletion({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 600,
  });

  const content = response.data.choices[0]?.message?.content || "";
  const tokens = response.data.usage?.total_tokens || 0;
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

  const { content, tokens } = await callOpenAI(companyId, prompt);
  const parsed = parseJSON(content);

  if (!parsed) throw new Error("IA_PARSE_ERROR");

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
        model: MODEL,
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
  const { content, tokens } = await callOpenAI(companyId, prompt);
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
  const { content, tokens } = await callOpenAI(companyId, prompt);
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
