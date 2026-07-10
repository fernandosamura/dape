// Variaveis de template Meta aparecem como {{1}}, {{2}} (posicional) ou
// {{customer_name}} (nomeado) - extrai a lista unica na ordem em que
// aparecem no corpo do template.
export const extractTemplateVariables = (bodyText) => {
  if (!bodyText) return [];
  const matches = [...bodyText.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(matches)];
};

// Substitui as variaveis do corpo pelos valores preenchidos, pra prévia.
export const renderTemplateBody = (bodyText, values) => {
  if (!bodyText) return bodyText;
  return bodyText.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => values?.[key] || match);
};
