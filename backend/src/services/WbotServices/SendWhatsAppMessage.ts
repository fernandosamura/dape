import { WAMessage } from "baileys";
import WALegacySocket from "baileys"
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import User from "../../models/User";

import formatBody from "../../helpers/Mustache";
import { dapleShield } from "../../dape/shield/dapleShield.service";
import { logger } from "../../utils/logger";
import CreateMessageService from "../MessageServices/CreateMessageService";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  /** userId do atendente que envia — usado para prefixo em grupos */
  userId?: number;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  userId
}: Request): Promise<WAMessage> => {
  let options = {};

  // DAPLE Shield — manual sends are non-blocking (log only)
  try {
    const shieldResult = await dapleShield.evaluate({
      companyId: ticket.companyId,
      whatsappId: ticket.whatsappId,
      source: "manual",
      ticketId: ticket.id,
      messagePreview: body ? body.substring(0, 200) : "",
    });
    if (!shieldResult.allowed) {
      logger.warn(`[DAPLE Shield] Alert (manual send allowed) for ticket ${ticket.id}: ${shieldResult.reason}`);
    }
  } catch (_shieldErr) { /* shield errors must never block manual sends */ }

  const wbot = await GetTicketWbot(ticket);

  // Determine the correct JID domain (some contacts use @lid for Advanced Privacy)
  let jidDomain = ticket.isGroup ? "g.us" : "s.whatsapp.net";
  if (!ticket.isGroup) {
    // Priority 1: check contact.isLid flag (works even when contact never replied)
    if (ticket.contact.isLid) {
      jidDomain = "lid";
    } else {
      // Fallback: detect lid from last incoming message JID
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

  // Para grupos, prefixar com o nome do atendente: "[Nome] mensagem"
  let finalBody = formatBody(body, ticket.contact);
  if (ticket.isGroup && userId) {
    try {
      const attendant = await User.findByPk(userId, { attributes: ["name"] });
      if (attendant?.name) {
        finalBody = `[${attendant.name}] ${finalBody}`;
      }
    } catch (_) {}
  }

  try {
    const sentMessage = await wbot.sendMessage(number,{
        text: finalBody
      },
      {
        ...options
      }
    );

    await ticket.update({ lastMessage: finalBody });

    // Feedback instantâneo: persiste e emite via socket ANTES do echo do Baileys chegar.
    // O echo em wbotMessageListener é descartado por deduplicação (Message.count check).
    if (sentMessage?.key?.id) {
      try {
        await CreateMessageService({
          messageData: {
            id: sentMessage.key.id,
            ticketId: ticket.id,
            body: finalBody,
            fromMe: true,
            mediaType: "conversation",
            read: true,
            ack: 1,
          },
          companyId: ticket.companyId,
        });
      } catch (optimisticErr) {
        // Não bloqueia: o echo do Baileys criará a mensagem normalmente
        logger.warn(`[SendWhatsAppMessage] optimistic emit falhou (ticket ${ticket.id}): ${(optimisticErr as any)?.message}`);
      }
    }

    // Para grupos: Baileys não dispara messages.update com ack confiável.
    // Forçar ack=2 (SERVER_ACK = enviado) imediatamente após envio bem-sucedido.
    if (ticket.isGroup && sentMessage?.key?.id) {
      const { Message } = require("../../models");
      setTimeout(async () => {
        try {
          await Message.update(
            { ack: 2 },
            { where: { id: sentMessage.key.id } }
          );
        } catch (_) {}
      }, 1500);
    }

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    const errMsg = (err as any)?.message || (err as any)?.output?.statusCode || String(err);
    await dapleShield.reportSendError(ticket.whatsappId, ticket.companyId, errMsg);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
