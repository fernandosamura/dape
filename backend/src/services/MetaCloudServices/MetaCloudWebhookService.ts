import Whatsapp from "../../models/Whatsapp";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Contact from "../../models/Contact";
import WhatsappTemplate from "../../models/WhatsappTemplate";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { downloadAndStoreMetaCloudMedia } from "./DownloadMetaCloudMedia";
import { resyncWabaHealth } from "./SyncWhatsappHealthService";
import { CloudApiChannel } from "../MessageChannel/CloudApiChannel";
import {
  verifyQueue,
  verifyRating,
  handleRating,
  handleChartbot
} from "../WbotServices/wbotMessageMenu";
import { decrypt } from "../../helpers/cryptoHelper";
import { getIO } from "../../libs/socket";
import { cacheLayer } from "../../libs/cache";
import { logger } from "../../utils/logger";

const MEDIA_TYPES = ["image", "audio", "video", "document", "sticker"];

interface MetaCloudMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; filename: string; mime_type: string; caption?: string };
  sticker?: { id: string; mime_type: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  button?: { text: string; payload: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

interface MetaCloudWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product?: string;
      metadata?: { display_phone_number: string; phone_number_id: string };
      contacts?: Array<{ profile: { name: string }; wa_id: string }>;
      messages?: MetaCloudMessage[];
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
      }>;
      // Campos do field "message_template_status_update" (Fase E)
      event?: string;
      message_template_id?: number;
      message_template_name?: string;
      message_template_language?: string;
      reason?: string;
    };
    field: string;
  }>;
}

// Corpo textual usado pra mensagens sem midia (texto/localizacao/botao) e
// como fallback quando o download de midia real (Fase 3) falha.
const getBodyFromMetaMessage = (msg: MetaCloudMessage): string => {
  switch (msg.type) {
    case "text":
      return msg.text?.body || "";
    case "image":
      return msg.image?.caption || "[imagem]";
    case "audio":
      return "[áudio]";
    case "video":
      return msg.video?.caption || "[vídeo]";
    case "document":
      return msg.document?.caption || msg.document?.filename || "[documento]";
    case "sticker":
      return "[figurinha]";
    case "location":
      return "[localização]";
    case "button":
      return msg.button?.text || "";
    case "interactive":
      return (
        msg.interactive?.button_reply?.title ||
        msg.interactive?.list_reply?.title ||
        "[interativo]"
      );
    default:
      return `[${msg.type}]`;
  }
};

const ackMap: Record<string, number> = {
  sent: 1,
  delivered: 2,
  read: 3,
  failed: -1
};

const getCaption = (msg: MetaCloudMessage): string => {
  switch (msg.type) {
    case "image":
      return msg.image?.caption || "";
    case "video":
      return msg.video?.caption || "";
    case "document":
      return msg.document?.caption || "";
    default:
      return "";
  }
};

// Baixa a midia real da Cloud API (Fase 3). Retorna null se o tipo nao tem
// midia associada, se faltar o token da conexao, ou se o download falhar -
// em qualquer um desses casos quem chama cai de volta no corpo textual
// placeholder, sem quebrar o processamento da mensagem.
const tryDownloadMedia = async (
  msg: MetaCloudMessage,
  whatsapp: Whatsapp
): Promise<{ filename: string; mimetype: string } | null> => {
  const mediaField = (msg as unknown as Record<string, { id?: string }>)[
    msg.type
  ];
  const mediaId = mediaField?.id;
  if (!mediaId || !whatsapp.metaAccessToken) return null;

  let accessToken: string;
  try {
    accessToken = decrypt(whatsapp.metaAccessToken);
  } catch (err) {
    logger.error(
      { err },
      "[MetaCloud] Erro ao decriptar token para download de mídia"
    );
    return null;
  }

  return downloadAndStoreMetaCloudMedia(
    mediaId,
    accessToken,
    msg.type === "document" ? msg.document?.filename : undefined
  );
};

const processIncomingMessage = async (
  msg: MetaCloudMessage,
  contactsProfile: MetaCloudWebhookEntry["changes"][0]["value"]["contacts"],
  whatsapp: Whatsapp
): Promise<void> => {
  const companyId = whatsapp.companyId;
  const number = msg.from.replace(/\D/g, "");
  const profile = contactsProfile?.find(c => c.wa_id === msg.from);
  const name = profile?.profile?.name || number;

  const contact = await CreateOrUpdateContactService({
    name,
    number,
    isGroup: false,
    companyId,
    whatsappId: whatsapp.id
  });

  const unreads = await cacheLayer.get(`contacts:${contact.id}:unreads`);
  const unreadMessages = +unreads + 1;
  await cacheLayer.set(`contacts:${contact.id}:unreads`, `${unreadMessages}`);

  const ticket = await FindOrCreateTicketService(
    contact,
    whatsapp.id,
    unreadMessages,
    companyId
  );

  let body: string;
  let mediaUrl: string | undefined;
  let mediaType: string = msg.type;

  if (MEDIA_TYPES.includes(msg.type)) {
    const media = await tryDownloadMedia(msg, whatsapp);
    if (media) {
      mediaUrl = media.filename;
      mediaType = media.mimetype.split("/")[0];
      body = getCaption(msg) || "-";
    } else {
      // Download falhou (ou faltou token) - cai pro corpo textual placeholder,
      // mensagem nao se perde mesmo sem a midia real.
      body = getBodyFromMetaMessage(msg);
    }
  } else {
    body = getBodyFromMetaMessage(msg);
  }

  await ticket.update({ lastMessage: body });

  await CreateMessageService({
    messageData: {
      id: msg.id,
      ticketId: ticket.id,
      contactId: contact.id,
      body,
      fromMe: false,
      mediaType,
      mediaUrl,
      read: false
    },
    companyId
  });

  if (ticket.status === "closed") {
    await ticket.update({ status: "pending" });
    await ticket.reload({
      include: [
        { model: Queue, as: "queue" },
        { model: User, as: "user" },
        { model: Contact, as: "contact" }
      ]
    });

    const io = getIO();
    io.to(`company-${companyId}-closed`)
      .to(`queue-${ticket.queueId}-closed`)
      .emit(`company-${companyId}-ticket`, {
        action: "delete",
        ticket,
        ticketId: ticket.id
      });

    io.to(`company-${companyId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
  }

  // Aciona o motor de menu/chatbot (Fase B) - mesma decisao usada pelo
  // handleMessage do Baileys, simplificada aqui pra so cobrir menu/chatbot
  // (grupos, agentes SDR/Pipeline e Flow Builder legado ficam de fora por
  // enquanto - o ticket segue disponivel pro atendente humano normalmente).
  const channel = new CloudApiChannel(whatsapp);

  if (body === "#") {
    await ticket.update({ queueOptionId: null, chatbot: false, queueId: null });
    await verifyQueue(channel, ticket, contact, body, false);
    return;
  }

  const ticketTraking = await FindOrCreateATicketTrakingService({
    ticketId: ticket.id,
    companyId
  });

  if (ticketTraking && verifyRating(ticketTraking)) {
    await handleRating(parseFloat(body), ticket, ticketTraking);
    return;
  }

  const dontReadTheFirstQuestion = ticket.queue === null;

  if (!ticket.queue && !ticket.userId) {
    await verifyQueue(channel, ticket, contact, body, false);
    if (ticketTraking.chatbotAt === null) {
      await ticketTraking.update({ chatbotAt: new Date() });
    }
  }

  await ticket.reload();

  if (ticket.queue && ticket.chatbot) {
    await handleChartbot(ticket, body, channel, dontReadTheFirstQuestion);
  }
};

const processStatusUpdate = async (status: {
  id: string;
  status: string;
}): Promise<void> => {
  const ack = ackMap[status.status];
  if (ack === undefined) return;

  const messageToUpdate = await Message.findByPk(status.id, {
    include: [
      "contact",
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });

  if (!messageToUpdate) return;
  // Nao regride o ack se chegar fora de ordem (ex: "delivered" apos "read"),
  // exceto "failed" que deve sempre ser registrado independente do estado atual.
  if (ack !== -1 && ack < messageToUpdate.ack) return;

  await messageToUpdate.update({ ack });

  const io = getIO();
  io.to(messageToUpdate.ticketId.toString()).emit(
    `company-${messageToUpdate.companyId}-appMessage`,
    {
      action: "update",
      message: messageToUpdate
    }
  );
};

// Mantem o WhatsappTemplate local sincronizado quando a Meta aprova/rejeita/
// pausa um template - #031 Fase E. Sem isso, a aprovacao so seria refletida
// na proxima sincronizacao manual.
const processTemplateStatusUpdate = async (value: {
  event?: string;
  message_template_id?: number;
  message_template_name?: string;
  reason?: string;
}): Promise<void> => {
  if (!value.message_template_id || !value.event) return;

  const metaTemplateId = String(value.message_template_id);
  const template = await WhatsappTemplate.findOne({
    where: { metaTemplateId }
  });

  if (!template) {
    logger.warn(
      `[MetaCloud] Webhook de status de template: template ${metaTemplateId} (${value.message_template_name}) não encontrado localmente`
    );
    return;
  }

  await template.update({ status: value.event });
  logger.info(
    `[MetaCloud] Template "${value.message_template_name}" atualizado para status ${value.event}${
      value.reason ? ` (motivo: ${value.reason})` : ""
    }`
  );
};

export const processMetaCloudWebhook = async (body: {
  entry?: MetaCloudWebhookEntry[];
}): Promise<void> => {
  try {
    if (!body.entry || !Array.isArray(body.entry)) return;

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        if (change.field === "message_template_status_update") {
          try {
            await processTemplateStatusUpdate(change.value);
          } catch (templateErr) {
            logger.error(
              { templateErr },
              "[MetaCloud] Erro ao processar atualização de status de template"
            );
          }
          continue;
        }

        // #031 Fase F - eventos de saude/conta. O formato exato desses
        // payloads varia e nao e totalmente documentado pela Meta, entao em
        // vez de tentar parsear campos especificos, usamos o evento so como
        // gatilho pra buscar o estado atual de verdade direto na Graph API
        // (mais confiavel). entry.id nesses eventos e o WABA ID.
        if (
          change.field === "phone_number_quality_update" ||
          change.field === "business_capability_update" ||
          change.field === "phone_number_name_update"
        ) {
          try {
            logger.info(
              `[MetaCloud] Evento de saúde recebido (${change.field}) para WABA ${entry.id} - re-sincronizando`
            );
            await resyncWabaHealth(entry.id);
          } catch (healthErr) {
            logger.error(
              { healthErr },
              `[MetaCloud] Erro ao re-sincronizar saúde após webhook ${change.field}`
            );
          }
          continue;
        }

        if (change.field === "security") {
          logger.warn(
            `[MetaCloud] Alerta de segurança recebido para WABA ${entry.id}: ${JSON.stringify(
              change.value
            )}`
          );
          continue;
        }

        if (change.field !== "messages") continue;
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const whatsapp = await Whatsapp.findOne({ where: { phoneNumberId } });
        if (!whatsapp) {
          logger.warn(
            `[MetaCloud] Webhook: conexão não encontrada para phoneNumberId=${phoneNumberId}`
          );
          continue;
        }

        if (value.messages) {
          for (const msg of value.messages) {
            try {
              logger.info(
                `[MetaCloud] Mensagem recebida de ${msg.from} — tipo: ${msg.type}`
              );
              await processIncomingMessage(msg, value.contacts, whatsapp);
            } catch (msgErr) {
              logger.error(
                { msgErr },
                `[MetaCloud] Erro ao processar mensagem ${msg.id}`
              );
            }
          }
        }

        if (value.statuses) {
          for (const status of value.statuses) {
            try {
              await processStatusUpdate(status);
            } catch (statusErr) {
              logger.error(
                { statusErr },
                `[MetaCloud] Erro ao processar status ${status.id}`
              );
            }
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "[MetaCloud] Erro ao processar webhook");
  }
};
