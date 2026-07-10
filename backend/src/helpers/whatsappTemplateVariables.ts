// Variaveis de template Meta aparecem como {{1}}, {{2}} (formato posicional,
// a maioria dos templates existentes) ou {{customer_name}} (formato nomeado,
// exigido em alguns fluxos novos do WhatsApp Manager). Extrai a lista unica
// de variaveis na ordem em que aparecem no corpo do template.
export const extractTemplateVariables = (bodyText: string): string[] => {
  if (!bodyText) return [];
  const matches = [...bodyText.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map(
    m => m[1]
  );
  return [...new Set(matches)];
};

// Substitui as variaveis do corpo pelos valores preenchidos - usado pra
// persistir uma versao legivel da mensagem no historico do ticket (em vez
// de gravar o {{1}}/{{2}} cru).
export const renderTemplateBody = (
  bodyText: string,
  values: Record<string, string>
): string => {
  if (!bodyText) return bodyText;
  return bodyText.replace(
    /\{\{\s*([^}]+?)\s*\}\}/g,
    (match, key) => values?.[key] ?? match
  );
};

// Monta o componente "body" no formato que a Cloud API espera: posicional
// (sem parameter_name) quando todas as variaveis sao numericas - formato
// da grande maioria dos templates ja aprovados - ou nomeado (com
// parameter_name) quando o template usa variaveis como {{customer_name}}.
export const buildBodyComponent = (
  variables: string[],
  values: Record<string, string>
): Array<{ type: string; parameters: unknown[] }> | undefined => {
  if (variables.length === 0) return undefined;

  const allNumeric = variables.every(v => /^\d+$/.test(v));

  return [
    {
      type: "body",
      parameters: variables.map(v => {
        const text = values?.[v] ?? "";
        return allNumeric
          ? { type: "text", text }
          : { type: "text", parameter_name: v, text };
      })
    }
  ];
};
