interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: unknown[];
}

interface TemplateHeader {
  format: string; // TEXT | IMAGE | VIDEO | DOCUMENT
  text?: string;
  variables: string[];
}

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
): { type: string; parameters: unknown[] } | undefined => {
  if (variables.length === 0) return undefined;

  const allNumeric = variables.every(v => /^\d+$/.test(v));

  return {
    type: "body",
    parameters: variables.map(v => {
      const text = values?.[v] ?? "";
      return allNumeric
        ? { type: "text", text }
        : { type: "text", parameter_name: v, text };
    })
  };
};

// Le o componente HEADER a partir dos "components" salvos na sincronizacao
// (JSONB vindo direto da Graph API) - necessario porque o header pode exigir
// midia (IMAGE/VIDEO/DOCUMENT) ou ter uma variavel de texto, nenhum dos dois
// aparece no bodyText.
export const getTemplateHeader = (
  components: unknown
): TemplateHeader | null => {
  if (!Array.isArray(components)) return null;
  const header = (components as TemplateComponent[]).find(
    c => c.type === "HEADER"
  );
  if (!header) return null;

  return {
    format: header.format || "TEXT",
    text: header.text,
    variables:
      header.format === "TEXT" ? extractTemplateVariables(header.text || "") : []
  };
};

// Monta o componente "header" quando o template exige - midia (link
// obrigatorio, fornecido pelo usuario na tela) ou texto com variavel.
// Templates com header de texto estatico (sem variavel) nao precisam de
// componente nenhum - retorna undefined nesse caso.
export const buildHeaderComponent = (
  header: TemplateHeader | null,
  headerMediaUrl?: string
): { type: string; parameters: unknown[] } | undefined => {
  if (!header) return undefined;

  if (header.format === "TEXT") {
    if (header.variables.length === 0) return undefined;
    return undefined; // header de texto com variavel - nao suportado ainda, ver ERR_META_CLOUD_TEMPLATE_HEADER_VARIABLE_UNSUPPORTED no service
  }

  if (!headerMediaUrl) return undefined;

  const key = header.format.toLowerCase();
  return {
    type: "header",
    parameters: [{ type: key, [key]: { link: headerMediaUrl } }]
  };
};
