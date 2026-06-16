export const SUMMARY_PROMPT = (messages: string): string => `
Você é um assistente comercial especializado em vendas B2B via WhatsApp.

Analise a conversa abaixo e retorne APENAS um JSON válido, sem markdown, sem explicações:
{
  "resumo": "2-3 frases resumindo o estado atual do lead",
  "proxima_acao": "ação específica e direta a ser tomada agora",
  "sentimento": "positivo" ou "neutro" ou "negativo",
  "intencao": "comprar" ou "pesquisar" ou "reclamar" ou "outro",
  "urgencia": "alta" ou "media" ou "baixa",
  "valor_estimado": número em reais ou null
}

Conversa:
${messages}
`.trim();

export const SUGGEST_REPLY_PROMPT = (summary: string, lastMessage: string): string => `
Você é especialista em vendas consultivas via WhatsApp para o mercado B2B brasileiro.

Contexto do lead: ${summary}
Última mensagem recebida: "${lastMessage}"

Gere exatamente 3 opções de resposta, do estilo mais direto ao mais consultivo.
Retorne APENAS um JSON válido, sem markdown:
{ "opcoes": ["resposta 1", "resposta 2", "resposta 3"] }
`.trim();

export const NEXT_ACTION_PROMPT = (summary: string, history: string): string => `
Você é um coach de vendas B2B especializado em WhatsApp.

Resumo do lead: ${summary}
Histórico recente: ${history}

Com base no contexto, sugira a próxima ação comercial mais eficaz.
Retorne APENAS um JSON válido, sem markdown:
{
  "acao": "descrição clara da ação a tomar",
  "prazo": "imediato" ou "hoje" ou "amanhã" ou "essa semana",
  "canal": "whatsapp" ou "ligação" ou "email" ou "reunião",
  "justificativa": "por que essa ação agora"
}
`.trim();
