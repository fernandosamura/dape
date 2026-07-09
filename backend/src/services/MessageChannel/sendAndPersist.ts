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
