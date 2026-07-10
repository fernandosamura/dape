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

// Le o componente HEADER a partir de "components" (salvo na sincronizacao) -
// necessario pra saber se o modelo exige uma URL de midia (imagem/video/
// documento) antes de poder ser enviado.
export const getTemplateHeader = (components) => {
  if (!Array.isArray(components)) return null;
  const header = components.find((c) => c.type === "HEADER");
  if (!header) return null;
  return {
    format: header.format || "TEXT",
    text: header.text,
    variables: header.format === "TEXT" ? extractTemplateVariables(header.text || "") : [],
  };
};
