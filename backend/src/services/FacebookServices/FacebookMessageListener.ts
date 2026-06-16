import axios from "axios";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";

const GRAPH_API_URL = "https://graph.facebook.com/v18.0";

interface IFacebookMessage {
  mid: string;
  text?: string;
  attachments?: Array<{
    type: string;
    payload: {
      url: string;
      sticker_id?: number;
    };
  }>;
  reply_to?: {
    mid: string;
  };
}

interface IFacebookMessaging {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: IFacebookMessage;
  postback?: { title: string; payload: string };
}

const getProfilePicture = async (
  senderId: string,
  token: string
): Promise<string> => {
  try {
    const { data } = await axios.get(
      `${GRAPH_API_URL}/${senderId}/picture?redirect=false&access_token=${token}`
    );
    return data?.data?.url || "";
  } catch {
    return "";
  }
};

const getUserProfile = async (
  senderId: string,
  token: string,
  channel: string
): Promise<{ name: string; picture: string }> => {
  try {
    const fields = channel === "instagram" ? "name,profile_pic" : "name,profile_pic";
    const { data } = await axios.get(
      `${GRAPH_API_URL}/${senderId}?fields=${fields}&access_token=${token}`
    );
    return {
      name: data.name || `${channel === "instagram" ? "Instagram" : "Facebook"} User`,
      picture: data.profile_pic || ""
    };
  } catch {
    return {
      name: `${channel === "instagram" ? "Instagram" : "Facebook"} User`,
      picture: ""
    };
  }
};

export const handleMessage = async (
  whatsapp: Whatsapp,
  data: IFacebookMessaging,
  channel: string,
  companyId: number
): Promise<void> => {
  try {
    const senderId = data.sender.id;
    const recipientId = data.recipient.id;

    // Ignore messages sent by the page itself (echo)
    if (senderId === whatsapp.facebookPageUserId) return;
    // Ignore if no message content
    if (!data.message && !data.postback) return;

    const token = whatsapp.facebookToken;
    const profile = await getUserProfile(senderId, token, channel);

    const contact = await CreateOrUpdateContactService({
      name: profile.name,
      number: senderId,
      profilePicUrl: profile.picture,
      isGroup: false,
      companyId,
    });

    const ticket = await FindOrCreateTicketService(
      contact,
      whatsapp.id,
      1,
      companyId
    );

    // Auto-open if pending
    if (ticket.status === "pending") {
      await UpdateTicketService({
        ticketData: { status: "pending" },
        ticketId: ticket.id,
        companyId
      });
    }

    let messageBody = "";
    let mediaUrl: string | undefined;
    let mediaType: string | undefined;

    if (data.message) {
      messageBody = data.message.text || "";

      if (data.message.attachments?.length) {
        const att = data.message.attachments[0];
        mediaUrl = att.payload.url;
        messageBody = att.type === "image" ? "🖼️ Imagem" :
                     att.type === "video" ? "🎥 Vídeo" :
                     att.type === "audio" ? "🎵 Áudio" :
                     att.type === "file"  ? "📎 Arquivo" : att.type;
        mediaType = att.type;
      }
    } else if (data.postback) {
      messageBody = data.postback.title || data.postback.payload;
    }

    if (!messageBody && !mediaUrl) return;

    const existingMessage = await Message.findOne({
      where: { id: data.message?.mid || `${data.timestamp}`, ticketId: ticket.id }
    });
    if (existingMessage) return; // deduplicate

    const messageData = {
      id: data.message?.mid || `fb_${data.timestamp}_${senderId}`,
      ticketId: ticket.id,
      contactId: contact.id,
      body: messageBody,
      fromMe: false,
      mediaType: mediaType || "text",
      mediaUrl,
      read: false,
      quotedMsgId: undefined,
      dataJson: JSON.stringify(data)
    };

    await ticket.update({ lastMessage: messageBody });

    const newMessage = await CreateMessageService({ messageData, companyId });

    const io = getIO();
    io.to(`company-${companyId}-mainchannel`).emit(
      `company-${companyId}-ticket`,
      { action: "update", ticket }
    );
    io.to(ticket.id.toString()).emit(`company-${companyId}-appMessage`, {
      action: "create",
      message: newMessage
    });

    logger.info(
      `[${channel.toUpperCase()}] Message received from ${senderId} in ticket ${ticket.id}`
    );
  } catch (error) {
    logger.error(`[FacebookMessageListener] Error handling message: ${error}`);
  }
};
