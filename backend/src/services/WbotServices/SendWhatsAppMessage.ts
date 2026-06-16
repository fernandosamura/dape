import { WAMessage } from "baileys";
import WALegacySocket from "baileys"
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<WAMessage> => {
  let options = {};
  const wbot = await GetTicketWbot(ticket);

  // Determine the correct JID domain (some contacts use @lid for Advanced Privacy)
  let jidDomain = ticket.isGroup ? "g.us" : "s.whatsapp.net";
  if (!ticket.isGroup) {
    const lastContactMsg = await Message.findOne({
      where: { ticketId: ticket.id, fromMe: false },
      order: [["createdAt", "DESC"]]
    });
    if (lastContactMsg?.dataJson) {
      try {
        const parsedMsg = JSON.parse(lastContactMsg.dataJson);
        const remoteJid: string = parsedMsg?.key?.remoteJid || "";
        if (remoteJid.includes("@lid")) {
          jidDomain = "lid";
        }
      } catch (_) {}
    }
  }

  const number = `${ticket.contact.number}@${jidDomain}`;

  if (quotedMsg) {
      const chatMessages = await Message.findOne({
        where: {
          id: quotedMsg.id
        }
      });

      if (chatMessages) {
        const msgFound = JSON.parse(chatMessages.dataJson);

        options = {
          quoted: {
            key: msgFound.key,
            message: {
              extendedTextMessage: msgFound.message.extendedTextMessage
            }
          }
        };
      }
    
  }

  try {
    const sentMessage = await wbot.sendMessage(number,{
        text: formatBody(body, ticket.contact)
      },
      {
        ...options
      }
    );

    await ticket.update({ lastMessage: formatBody(body, ticket.contact) });
    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
