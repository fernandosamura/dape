import axios from "axios";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import { decrypt } from "../../helpers/cryptoHelper";
import { dapleShield } from "../../dape/shield/dapleShield.service";
import { logger } from "../../utils/logger";
import CreateMessageService from "../MessageServices/CreateMessageService";

const GRAPH_API_URL = "https://graph.facebook.com/v20.0";

interface SendMetaCloudMessageParams {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  mediaUrl?: string;
  mediaType?: string;
  source?: string;
}

interface SendMetaCloudMessageResult {
  externalId: string;
}

const SendMetaCloudMessage = async ({
  body,
  ticket,
  quotedMsg,
  mediaUrl,
  mediaType,
  source = "manual",
}: SendMetaCloudMessageParams): Promise<SendMetaCloudMessageResult> => {
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  if (
    !whatsapp ||
    whatsapp.providerType !== "meta_cloud" ||
    !whatsapp.metaAccessToken ||
    !whatsapp.phoneNumberId
  ) {
    throw new AppError("ERR_META_CLOUD_NOT_CONFIGURED");
  }

  // DAPLE Shield check
  const shieldResult = await dapleShield.evaluate({
    companyId: ticket.companyId,
    whatsappId: ticket.whatsappId,
    source: source as any,
  });
  if (!shieldResult.allowed && source !== "manual") {
    logger.warn(`[MetaCloud] Shield bloqueou envio: ${shieldResult.reason}`);
    return;
  }

  let token: string;
  try {
    token = decrypt(whatsapp.metaAccessToken);
  } catch {
    throw new AppError("ERR_META_CLOUD_TOKEN_DECRYPT");
  }

  const contact = ticket.contact || (await Contact.findByPk(ticket.contactId));
  const to = contact?.number;
  if (!to) throw new AppError("ERR_META_CLOUD_NO_NUMBER");

  let payload: any;

  if (mediaUrl && mediaType) {
    payload = {
      messaging_product: "whatsapp",
      to,
      type: mediaType,
      [mediaType]: { link: mediaUrl },
    };
  } else {
    payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: false },
    };
  }

  if (quotedMsg) {
    payload.context = { message_id: quotedMsg.id };
  }

  try {
    const response = await axios.post(
      `${GRAPH_API_URL}/${whatsapp.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    await ticket.update({ lastMessage: body || `[${mediaType}]` });

    const externalId = response.data?.messages?.[0]?.id;
    if (!externalId) {
      throw new AppError("ERR_META_CLOUD_SEND_NO_ID");
    }

    // Persiste e emite via socket - sem isso a mensagem chega no WhatsApp mas
    // nunca aparece na tela do Daple (o envio Baileys ja faz isso, esse
    // caminho da Cloud API estava faltando desde a implementacao original).
    try {
      await CreateMessageService({
        messageData: {
          id: externalId,
          ticketId: ticket.id,
          body: body || `[${mediaType}]`,
          fromMe: true,
          mediaType: mediaUrl && mediaType ? mediaType : "conversation",
          mediaUrl: mediaUrl || undefined,
          read: true,
          ack: 1,
        },
        companyId: ticket.companyId,
      });
    } catch (persistErr) {
      logger.warn(
        `[MetaCloud] Falha ao persistir mensagem enviada (ticket ${ticket.id}): ${(persistErr as any)?.message}`
      );
    }

    return { externalId };
  } catch (err: any) {
    await dapleShield.reportSendError(ticket.whatsappId, ticket.companyId, err?.message || "send_failed");
    logger.error({ err }, "[MetaCloud] Erro ao enviar mensagem");
    throw new AppError("ERR_META_CLOUD_SEND_FAILED");
  }
};

export default SendMetaCloudMessage;
