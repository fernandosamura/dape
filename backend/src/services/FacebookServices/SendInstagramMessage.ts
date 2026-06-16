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

const SendInstagramMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<void> => {
  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  if (!whatsapp || !whatsapp.facebookToken) {
    throw new AppError("ERR_INSTAGRAM_TOKEN_NOT_FOUND");
  }

  const igAccountId = whatsapp.facebookPageUserId;
  const token = whatsapp.facebookToken;
  const recipientId = ticket.contact.number;

  const messageData: any = {
    recipient: { id: recipientId },
    message: { text: formatBody(body, ticket.contact) }
  };

  try {
    await axios.post(
      `${GRAPH_API_URL}/${igAccountId}/messages?access_token=${token}`,
      messageData
    );
    await ticket.update({ lastMessage: formatBody(body, ticket.contact) });
  } catch (err: any) {
    Sentry.captureException(err);
    const errorMsg = err.response?.data?.error?.message || err.message;
    throw new AppError(`ERR_SENDING_INSTAGRAM_MSG: ${errorMsg}`);
  }
};

export default SendInstagramMessage;
