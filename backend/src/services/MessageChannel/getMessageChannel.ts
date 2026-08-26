import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { MessageChannel } from "./MessageChannelTypes";
import { CloudApiChannel } from "./CloudApiChannel";
import { CoexistenceChannel } from "./CoexistenceChannel";
import { BaileysChannel } from "./BaileysChannel";

// Ponto unico de decisao entre os tres transportes. O motor de negocio
// (fases B em diante) chama so isso - nunca precisa saber se o numero por
// tras e Baileys, Cloud API tradicional ou Coexistence.
export const getMessageChannel = async (
  ticket: Ticket
): Promise<MessageChannel> => {
  let whatsapp = ticket.whatsapp;
  if (!whatsapp) {
    whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  }

  if (whatsapp?.providerType === "meta_cloud_coexistence") {
    return new CoexistenceChannel(whatsapp);
  }

  if (whatsapp?.providerType === "meta_cloud") {
    return new CloudApiChannel(whatsapp);
  }

  return new BaileysChannel();
};
