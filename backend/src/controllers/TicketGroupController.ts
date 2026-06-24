import { Request, Response } from "express";
import { joinTicketGroup, leaveTicketGroup, listTicketGroupUsers } from "../services/TicketServices/TicketGroupService";

export const join = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { id: userId, companyId } = (req as any).user;

  await joinTicketGroup(Number(ticketId), userId, companyId);
  return res.status(200).json({ message: "OK" });
};

export const leave = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { id: userId, companyId } = (req as any).user;

  await leaveTicketGroup(Number(ticketId), userId, companyId);
  return res.status(200).json({ message: "OK" });
};

export const users = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = (req as any).user;

  const chatUsers = await listTicketGroupUsers(Number(ticketId), companyId);
  return res.status(200).json(chatUsers);
};
