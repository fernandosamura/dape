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

// Le o footer estatico do template, pra exibir na prévia (a Meta sempre
// envia o footer junto quando o template tem um, mesmo sem parâmetro).
export const getTemplateFooter = (components) => {
  if (!Array.isArray(components)) return null;
  const footer = components.find((c) => c.type === "FOOTER");
  return footer?.text || null;
};

// Le os botões do template (URL, telefone ou quick reply), pra exibir na
// prévia - a Cloud API sempre inclui os botões do template aprovado no
// envio.
export const getTemplateButtons = (components) => {
  if (!Array.isArray(components)) return [];
  const buttonsComponent = components.find((c) => c.type === "BUTTONS");
  return buttonsComponent?.buttons || [];
};
