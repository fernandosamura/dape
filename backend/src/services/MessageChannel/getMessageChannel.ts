import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { MessageChannel } from "./MessageChannelTypes";
import { CloudApiChannel } from "./CloudApiChannel";
import { BaileysChannel } from "./BaileysChannel";

// Ponto unico de decisao entre os dois transportes. O motor de negocio
// (fases B em diante) chama so isso - nunca precisa saber se o numero por
// tras e Baileys ou Cloud API.
export const getMessageChannel = async (
  ticket: Ticket
): Promise<MessageChannel> => {
  let whatsapp = ticket.whatsapp;
  if (!whatsapp) {
    whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  }

  if (whatsapp?.providerType === "meta_cloud") {
    return new CloudApiChannel(whatsapp);
  }

  return new BaileysChannel();
};
