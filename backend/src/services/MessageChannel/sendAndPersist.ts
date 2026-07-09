import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { MessageChannel } from "./MessageChannelTypes";

// Envia um texto pelo canal (Baileys ou Cloud API) e persiste a mensagem
// enviada no banco - mesmo padrao que o Baileys ja usava com
// verifyMessage(sentMessage, ticket, contact) pra mensagens do bot, agora
// generico pros dois transportes. So se aplica a mensagens fromMe: true (o
// bot enviando), por isso nao reabre ticket fechado (essa regra so vale pra
// mensagem recebida do cliente).
export const sendAndPersistText = async (
  channel: MessageChannel,
  ticket: Ticket,
  body: string
): Promise<Message> => {
  const { externalId } = await channel.sendText(ticket, body);
  return CreateMessageService({
    messageData: {
      id: externalId,
      ticketId: ticket.id,
      body,
      fromMe: true,
      read: true
    },
    companyId: ticket.companyId
  });
};

// Mesma ideia de sendAndPersistText, mas pra midia (ex: resposta em audio da
// IA). Recebe so o nome do arquivo ja salvo (R2 ou public/ local) - calcula a
// URL publica completa pra envio (os dois canais exigem URL real, nao um
// buffer bruto) e guarda so o nome do arquivo no banco, igual ao getter de
// Message.mediaUrl ja faz pro resto do sistema.
export const sendAndPersistMedia = async (
  channel: MessageChannel,
  ticket: Ticket,
  filename: string,
  mediaType: string,
  caption?: string
): Promise<Message> => {
  const publicUrl =
    process.env.CLOUDFLARE_R2_ENABLED === "true" && process.env.CLOUDFLARE_R2_PUBLIC_URL
      ? `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${filename}`
      : `${process.env.BACKEND_URL}/public/${filename}`;

  const { externalId } = await channel.sendMedia(
    ticket,
    publicUrl,
    mediaType,
    caption
  );
  return CreateMessageService({
    messageData: {
      id: externalId,
      ticketId: ticket.id,
      body: caption || "-",
      mediaUrl: filename,
      mediaType,
      fromMe: true,
      read: true
    },
    companyId: ticket.companyId
  });
};
