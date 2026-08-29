import axios from "axios";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import WhatsappTemplate from "../../models/WhatsappTemplate";
import Ticket from "../../models/Ticket";
import { decrypt } from "../../helpers/cryptoHelper";
import { logger } from "../../utils/logger";
import { sanitizeAxiosError } from "../../helpers/sanitizeAxiosError";
import CreateMessageService from "../MessageServices/CreateMessageService";
import {
  extractTemplateVariables,
  buildBodyComponent,
  getTemplateHeader,
  buildHeaderComponent,
  renderFullTemplateMessage
} from "../../helpers/whatsappTemplateVariables";

const GRAPH_API_URL = "https://graph.facebook.com/v20.0";

interface SendMetaCloudTemplateParams {
  whatsapp: Whatsapp;
  to: string;
  template: WhatsappTemplate;
  // Valores pra substituir as variaveis do corpo do template ({{1}}/{{2}}
  // posicional ou {{customer_name}} nomeado), indexados pela chave que
  // aparece entre chaves - opcional, so quando o template tem variaveis.
  bodyParams?: Record<string, string>;
  // URL da midia (imagem/video/documento) exigida quando o header do
  // template nao e texto estatico - obrigatorio nesse caso, a Cloud API
  // rejeita o envio sem isso (erro 132012).
  headerMediaUrl?: string;
  // Quando informado, persiste a mensagem enviada no historico do ticket
  // (usado pelo envio manual de template no atendimento) - o disparo de
  // campanha (queues.ts) nao passa ticket, so numero direto.
  ticket?: Ticket;
}

interface SendMetaCloudTemplateResult {
  externalId: string;
}

// Envio ticket-less (por numero direto), usado pelo disparo de campanha
// (queues.ts) - diferente de SendMetaCloudMessage.ts, que e centrado em
// ticket e usado pelo motor de menu/IA/chat. Mensagem de negocio fora da
// janela de 24h exige template pre-aprovado - e o unico jeito valido de
// iniciar conversa via Cloud API nesse cenario.
const SendMetaCloudTemplate = async ({
  whatsapp,
  to,
  template,
  bodyParams,
  headerMediaUrl,
  ticket
}: SendMetaCloudTemplateParams): Promise<SendMetaCloudTemplateResult> => {
  if (!whatsapp.metaAccessToken || !whatsapp.phoneNumberId) {
    throw new AppError("ERR_META_CLOUD_NOT_CONFIGURED");
  }
  if (template.status !== "APPROVED") {
    throw new AppError("ERR_META_CLOUD_TEMPLATE_NOT_APPROVED");
  }

  const header = getTemplateHeader(template.components);
  if (header && header.format !== "TEXT" && !headerMediaUrl) {
    throw new AppError("ERR_META_CLOUD_TEMPLATE_HEADER_MEDIA_REQUIRED");
  }
  if (header && header.format === "TEXT" && header.variables.length > 0) {
    throw new AppError("ERR_META_CLOUD_TEMPLATE_HEADER_VARIABLE_UNSUPPORTED");
  }

  let token: string;
  try {
    token = decrypt(whatsapp.metaAccessToken);
  } catch {
    throw new AppError("ERR_META_CLOUD_TOKEN_DECRYPT");
  }

  const variables = extractTemplateVariables(template.bodyText);
  const bodyComponent = buildBodyComponent(variables, bodyParams || {});
  const headerComponent = buildHeaderComponent(header, headerMediaUrl);
  const components = [headerComponent, bodyComponent].filter(Boolean);

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      ...(components.length > 0 ? { components } : {})
    }
  };

  try {
    const response = await axios.post(
      `${GRAPH_API_URL}/${whatsapp.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const externalId = response.data?.messages?.[0]?.id;
    if (!externalId) {
      throw new AppError("ERR_META_CLOUD_SEND_NO_ID");
    }

    if (ticket) {
      const renderedBody = renderFullTemplateMessage(
        template.components,
        template.bodyText,
        bodyParams || {}
      );
      await ticket.update({ lastMessage: renderedBody });
      try {
        await CreateMessageService({
          messageData: {
            id: externalId,
            ticketId: ticket.id,
            body: renderedBody,
            fromMe: true,
            mediaType: "conversation",
            read: true,
            ack: 1
          },
          companyId: ticket.companyId
        });
      } catch (persistErr) {
        logger.warn(
          `[MetaCloud] Falha ao persistir template enviado (ticket ${ticket.id}): ${(persistErr as any)?.message}`
        );
      }
    }

    return { externalId };
  } catch (err: unknown) {
    logger.error({ err: sanitizeAxiosError(err) }, "[MetaCloud] Erro ao enviar template");
    throw new AppError("ERR_META_CLOUD_TEMPLATE_SEND_FAILED");
  }
};

export default SendMetaCloudTemplate;
