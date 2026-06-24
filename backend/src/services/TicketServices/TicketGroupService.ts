import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import TicketUser from "../../models/TicketUser";
import User from "../../models/User";
import AppError from "../../errors/AppError";

/**
 * Adiciona um atendente ao grupo (tabela TicketUsers).
 * Idempotente: segunda chamada com o mesmo par nao lanca erro.
 */
export async function joinTicketGroup(ticketId: number, userId: number, companyId: number): Promise<void> {
  const ticket = await Ticket.findOne({ where: { id: ticketId, companyId } });
  if (!ticket) throw new AppError("ERR_TICKET_NOT_FOUND", 404);
  if (!ticket.isGroup) throw new AppError("ERR_TICKET_NOT_A_GROUP", 400);

  await TicketUser.findOrCreate({ where: { ticketId, userId } });

  const io = getIO();
  io.to(String(companyId)).emit(`company-${companyId}-ticket`, {
    action: "update",
    ticket: { id: ticketId }
  });
}

/**
 * Remove um atendente do grupo (tabela TicketUsers).
 */
export async function leaveTicketGroup(ticketId: number, userId: number, companyId: number): Promise<void> {
  const ticket = await Ticket.findOne({ where: { id: ticketId, companyId } });
  if (!ticket) throw new AppError("ERR_TICKET_NOT_FOUND", 404);

  await TicketUser.destroy({ where: { ticketId, userId } });

  const io = getIO();
  io.to(String(companyId)).emit(`company-${companyId}-ticket`, {
    action: "update",
    ticket: { id: ticketId }
  });
}

/**
 * Lista todos os atendentes de um grupo.
 */
export async function listTicketGroupUsers(ticketId: number, companyId: number): Promise<User[]> {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId },
    include: [{ model: User, as: "chatUsers", attributes: ["id", "name", "email", "profile"] }]
  });
  if (!ticket) throw new AppError("ERR_TICKET_NOT_FOUND", 404);
  return (ticket as any).chatUsers || [];
}
