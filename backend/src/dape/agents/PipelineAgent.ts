import { BaseAgent } from "./BaseAgent";
import { callAIProvider } from "../../services/AIProviderService/AIProviderRouter";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";

export type DealStage = "prospecting" | "qualification" | "proposal" | "negotiation" | "closing";

export interface StageAdviceSuggestion {
  currentStage: DealStage;
  suggestedStage: DealStage;
  shouldAdvance: boolean;
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
    // base execute — not used directly; use suggestDealStage instead
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

      console.log(`[PipelineAgent] Stage suggestion for deal ${dealId}, company ${this.companyId}:`, result);
      return result as StageAdviceSuggestion;
    } catch (err) {
      console.error(`[PipelineAgent] Error suggesting stage for deal ${dealId}:`, err);
      return null;
    }
  }
}
