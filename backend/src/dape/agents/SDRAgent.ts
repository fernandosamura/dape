import { BaseAgent } from "./BaseAgent";
import { callAIProvider } from "../../services/AIProviderService/AIProviderRouter";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";

export interface LeadQualification {
  contactName: string | null;
  painPoint: string | null;
  urgency: "high" | "medium" | "low" | null;
  qualified: boolean;
  summary: string;
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

export class SDRAgent extends BaseAgent {
  constructor(companyId: number) {
    super(companyId, "dape_ia");
  }

  async execute(): Promise<void> {
    // base execute — not used directly; use qualifyLead instead
  }

  async qualifyLead(contactId: number, lastMessage: string): Promise<LeadQualification | null> {
    const initialized = await this.initialize();
    if (!initialized || !this.canExecute()) {
      console.log(`[SDRAgent] Skipping qualification for contact ${contactId} — mode: ${this.operationMode}`);
      return null;
    }

    const prompt = `Você é um agente SDR especializado em qualificação de leads. 
Analise a mensagem abaixo e extraia as seguintes informações em JSON:
- contactName: nome do contato (null se não mencionado)
- painPoint: principal problema ou necessidade (null se não identificado)
- urgency: urgência da demanda ("high", "medium", "low") baseado no tom e contexto
- qualified: true se o lead demonstra interesse real, false caso contrário
- summary: resumo em 1 linha do que o lead precisa

Responda APENAS com o JSON, sem markdown.

Mensagem: "${lastMessage}"`;

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
        console.warn(`[SDRAgent] Could not parse AI response for contact ${contactId}`);
        return null;
      }

      console.log(`[SDRAgent] Lead qualified for contact ${contactId}, company ${this.companyId}:`, result);
      return result as LeadQualification;
    } catch (err) {
      console.error(`[SDRAgent] Error qualifying lead ${contactId}:`, err);
      return null;
    }
  }
}
