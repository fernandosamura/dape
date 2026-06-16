import axios from "axios";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import formatBody from "../../helpers/Mustache";

const GRAPH_API_URL = "https://graph.facebook.com/v18.0";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

const SendFacebookMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<void> => {
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  if (!whatsapp || !whatsapp.facebookToken) {
    throw new AppError("ERR_FACEBOOK_TOKEN_NOT_FOUND");
  }

  const pageId = whatsapp.facebookPageUserId;
  const token = whatsapp.facebookToken;
  const recipientId = ticket.contact.number;

  const messageData: any = {
    messaging_type: "RESPONSE",
    recipient: { id: recipientId },
    message: { text: formatBody(body, ticket.contact) }
  };

  if (quotedMsg) {
    // Facebook doesn't support native quote, include reference in text
    const refMsg = await Message.findByPk(quotedMsg.id);
    if (refMsg) {
      messageData.message.text = `↩️ "${refMsg.body}"\n\n${messageData.message.text}`;
    }
  }

  try {
    await axios.post(
      `${GRAPH_API_URL}/${pageId}/messages?access_token=${token}`,
      messageData
    );
    await ticket.update({ lastMessage: formatBody(body, ticket.contact) });
  } catch (err: any) {
    Sentry.captureException(err);
    const errorMsg = err.response?.data?.error?.message || err.message;
    throw new AppError(`ERR_SENDING_FACEBOOK_MSG: ${errorMsg}`);
  }
};

export default SendFacebookMessage;
