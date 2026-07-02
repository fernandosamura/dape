import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";
import Prompt from "../../models/Prompt";

const INCLUDE_OPTIONS = [
  {
    model: Contact,
    as: "contact",
    attributes: ["id", "name", "number", "email", "profilePicUrl"],
    include: ["extraInfo"]
  },
  {
    model: User,
    as: "user",
    attributes: ["id", "name"]
  },
  {
    model: Queue,
    as: "queue",
    attributes: ["id", "name", "color"],
    include: ["prompt", "queueIntegrations"]
  },
  {
    model: Whatsapp,
    as: "whatsapp",
    attributes: ["name"]
  },
  {
    model: Tag,
    as: "tags",
    attributes: ["id", "name", "color"]
  }
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ShowTicketService = async (
  id: string | number,
  companyId: number
): Promise<Ticket> => {
  let ticket: Ticket | null;

  // Se o id parece um UUID, busca pela coluna uuid; caso contrário usa findByPk (integer)
  if (typeof id === "string" && UUID_REGEX.test(id)) {
    ticket = await Ticket.findOne({
      where: { uuid: id },
      include: INCLUDE_OPTIONS as any
    });
  } else {
    ticket = await Ticket.findByPk(id, {
      include: INCLUDE_OPTIONS as any
    });
  }

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  if (ticket.companyId !== companyId) {
    throw new AppError("Não é possível consultar registros de outra empresa");
  }

  return ticket;
};

export default ShowTicketService;
