import axios from "axios";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import WhatsappTemplate from "../../models/WhatsappTemplate";
import { decrypt } from "../../helpers/cryptoHelper";
import { logger } from "../../utils/logger";

const GRAPH_API_URL = "https://graph.facebook.com/v20.0";

interface SendMetaCloudTemplateParams {
  whatsapp: Whatsapp;
  to: string;
  template: WhatsappTemplate;
  // Valores pra substituir as variaveis {{1}}, {{2}} etc do corpo do
  // template, na ordem em que aparecem - opcional, so quando o template tem
  // variaveis.
  bodyParams?: string[];
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
  bodyParams
}: SendMetaCloudTemplateParams): Promise<SendMetaCloudTemplateResult> => {
  if (!whatsapp.metaAccessToken || !whatsapp.phoneNumberId) {
    throw new AppError("ERR_META_CLOUD_NOT_CONFIGURED");
  }
  if (template.status !== "APPROVED") {
    throw new AppError("ERR_META_CLOUD_TEMPLATE_NOT_APPROVED");
  }

  let token: string;
  try {
    token = decrypt(whatsapp.metaAccessToken);
  } catch {
    throw new AppError("ERR_META_CLOUD_TOKEN_DECRYPT");
  }

  const components =
    bodyParams && bodyParams.length > 0
      ? [
          {
            type: "body",
            parameters: bodyParams.map(text => ({ type: "text", text }))
          }
        ]
      : undefined;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      ...(components ? { components } : {})
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
    return { externalId };
  } catch (err: unknown) {
    logger.error({ err }, "[MetaCloud] Erro ao enviar template");
    throw new AppError("ERR_META_CLOUD_TEMPLATE_SEND_FAILED");
  }
};

export default SendMetaCloudTemplate;
