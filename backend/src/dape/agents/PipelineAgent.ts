import { BaseAgent } from "./BaseAgent";
import { callAIProvider } from "../../services/AIProviderService/AIProviderRouter";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";

export type DealStage = "prospecting" | "qualification" | "proposal" | "negotiation" | "closing";

export interface StageAdviceSuggestion {
  dealId: number;
  currentStage: DealStage;
  suggestedStage: DealStage;
  shouldAdvance: boolean;
  confidence: string;
  reasoning: string;
}

interface AISettings {
  provider: any;
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

  const provider = (get("aiProvider") || "openai") as any;
  const model = get("aiModel") || "gpt-4o-mini";

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

function parseJSON(text: string): any {
  try {
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

export class PipelineAgent extends BaseAgent {
  constructor(companyId: number) {
    super(companyId, "dape_pipeline");
  }

  async execute(): Promise<void> {
    // base execute — not used directly; use analyzeConversationAndSuggestStage instead
  }

  async analyzeConversationAndSuggestStage(
    contactId: number,
    ticketId: number,
    companyId: number
  ): Promise<StageAdviceSuggestion | null> {
    const initialized = await this.initialize();
    if (!initialized || !this.canExecute()) {
      console.log(`[PipelineAgent] Skipping stage analysis for contact ${contactId} — mode: ${this.operationMode}`);
      return null;
    }

    try {
      // Fetch last 10 messages from the ticket
      const Message = (await import("../../models/Message")).default;
      const messages = await Message.findAll({
        where: { ticketId },
        order: [["createdAt", "DESC"]],
        limit: 10,
        attributes: ["body", "fromMe", "createdAt"],
      });

      const chatHistory = messages
        .reverse()
        .map(m => `${m.fromMe ? "Atendente" : "Cliente"}: ${m.body || "[mídia]"}`)
        .join("\n");

      // Check if contact has an open Deal
      const DapeDeal = (await import("../../models/DapeDeal")).default;
      const deal = await DapeDeal.findOne({
        where: { contactId, companyId, status: "open" },
        order: [["createdAt", "DESC"]],
      });

      if (!deal) {
        console.log(`[PipelineAgent] No open deal for contact ${contactId}`);
        return null;
      }

      const settings = await getCompanyAISettings(companyId);

      const prompt = `Você é um especialista em vendas analisando uma conversa de WhatsApp para gerenciar um funil de vendas CRM.

Estágios do funil (em ordem de progressão):
1. prospecting — lead identificado, sem qualificação ainda
2. qualification — lead demonstrou interesse, necessidades sendo identificadas
3. proposal — proposta ou orçamento foi discutido
4. negotiation — está negociando condições, preço, prazo
5. closing — pronto para fechar, aguardando decisão final

Estágio atual do Deal: "${deal.stage}"

Analise as últimas mensagens e retorne APENAS um JSON válido:
{
  "suggestedStage": "<um dos 5 estágios acima>",
  "shouldAdvance": true/false,
  "confidence": "high"/"medium"/"low",
  "reasoning": "<motivo em 1 frase>"
}

Regras:
- Só sugira avanço se houver evidência CLARA na conversa
- "confidence: high" apenas quando há sinal inequívoco de progressão
- Nunca regrida o estágio (não sugira estágio anterior ao atual)
- Se a conversa for inconclusiva, mantenha o estágio atual

Conversa recente:
${chatHistory}`;

      const responseText = await callAIProvider({
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 200,
        temperature: 0.3,
        baseUrl: settings.baseUrl,
      });

      const parsed = parseJSON(responseText);
      if (!parsed) {
        console.warn(`[PipelineAgent] Could not parse AI response for contact ${contactId}`);
        return null;
      }

      const suggestion: StageAdviceSuggestion = {
        dealId: deal.id,
        currentStage: deal.stage as DealStage,
        suggestedStage: parsed.suggestedStage as DealStage,
        shouldAdvance: parsed.shouldAdvance,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
      };

      console.log(`[PipelineAgent] Stage analysis for contact ${contactId}, deal ${deal.id}, company ${companyId}:`, suggestion);
      return suggestion;
    } catch (err) {
      console.error(`[PipelineAgent] Error analyzing conversation for contact ${contactId}:`, err);
      return null;
    }
  }

  async suggestDealStage(dealId: number, chatHistory: string): Promise<StageAdviceSuggestion | null> {
    const initialized = await this.initialize();
    if (!initialized || !this.canExecute()) {
      console.log(`[PipelineAgent] Skipping stage suggestion for deal ${dealId} — mode: ${this.operationMode}`);
      return null;
    }

    const prompt = `Você é um especialista em vendas e CRM. 
Com base no histórico de conversa abaixo, sugira se o negócio deve avançar de estágio no funil de vendas.

Estágios possíveis (em ordem): prospecting → qualification → proposal → negotiation → closing

Responda em JSON:
- currentStage: estágio atual identificado
- suggestedStage: estágio sugerido
- shouldAdvance: true se deve avançar, false se deve permanecer
- reasoning: motivo em 1 frase

Responda APENAS com o JSON.

Histórico:
${chatHistory}`;

    try {
      const settings = await getCompanyAISettings(this.companyId);
      const responseText = await callAIProvider({
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 300,
        temperature: 0.4,
        baseUrl: settings.baseUrl,
      });

      const result = parseJSON(responseText);
      if (!result) {
        console.warn(`[PipelineAgent] Could not parse AI response for deal ${dealId}`);
        return null;
      }

      const suggestion: StageAdviceSuggestion = {
        dealId,
        currentStage: result.currentStage as DealStage,
        suggestedStage: result.suggestedStage as DealStage,
        shouldAdvance: result.shouldAdvance,
        confidence: result.confidence || "low",
        reasoning: result.reasoning,
      };

      console.log(`[PipelineAgent] Stage suggestion for deal ${dealId}, company ${this.companyId}:`, suggestion);
      return suggestion;
    } catch (err) {
      console.error(`[PipelineAgent] Error suggesting stage for deal ${dealId}:`, err);
      return null;
    }
  }
}
