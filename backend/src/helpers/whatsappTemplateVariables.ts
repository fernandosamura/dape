interface TemplateButton {
  type: string;
  text?: string;
  url?: string;
  phone_number?: string;
}

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: TemplateButton[];
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

// Le o footer estatico do template (nunca tem variavel, a Meta nao permite).
export const getTemplateFooter = (components: unknown): string | null => {
  if (!Array.isArray(components)) return null;
  const footer = (components as TemplateComponent[]).find(
    c => c.type === "FOOTER"
  );
  return footer?.text || null;
};

// Le os botoes do template (URL, telefone ou quick reply) pra exibir na
// previa - a Cloud API sempre inclui os botoes do template aprovado no
// envio, independente dos parametros passados pelo DAPLE.
export const getTemplateButtons = (
  components: unknown
): TemplateButton[] => {
  if (!Array.isArray(components)) return [];
  const buttonsComponent = (components as TemplateComponent[]).find(
    c => c.type === "BUTTONS"
  );
  return buttonsComponent?.buttons || [];
};

// Monta o texto completo do template (header + body + footer + botoes) pra
// persistir no historico do ticket - sem isso a conversa no DAPLE mostrava
// so o corpo, enquanto o contato recebia o template inteiro (header,
// rodape e link do botao) pela Cloud API.
export const renderFullTemplateMessage = (
  components: unknown,
  bodyText: string,
  bodyValues: Record<string, string>
): string => {
  const parts: string[] = [];

  const header = getTemplateHeader(components);
  if (header?.format === "TEXT" && header.text) {
    parts.push(header.text);
  }

  if (bodyText) {
    parts.push(renderTemplateBody(bodyText, bodyValues));
  }

  const footer = getTemplateFooter(components);
  if (footer) parts.push(footer);

  const buttons = getTemplateButtons(components);
  buttons.forEach(b => {
    if (b.type === "URL" && b.url) parts.push(`${b.text}: ${b.url}`);
    else if (b.type === "PHONE_NUMBER" && b.phone_number) {
      parts.push(`${b.text}: ${b.phone_number}`);
    } else if (b.text) parts.push(b.text);
  });

  return parts.join("\n\n");
};
