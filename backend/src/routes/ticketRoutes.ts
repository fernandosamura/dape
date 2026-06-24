import express from "express";
import isAuth from "../middleware/isAuth";

import * as TicketController from "../controllers/TicketController";

const ticketRoutes = express.Router();

ticketRoutes.get("/tickets", isAuth, TicketController.index);

ticketRoutes.get("/tickets/:ticketId", isAuth, TicketController.show);

ticketRoutes.get("/ticket/kanban", isAuth, TicketController.kanban);

ticketRoutes.get("/tickets/u/:uuid", isAuth, TicketController.showFromUUID);

ticketRoutes.post("/tickets", isAuth, TicketController.store);

ticketRoutes.put("/tickets/:ticketId", isAuth, TicketController.update);

ticketRoutes.delete("/tickets/:ticketId", isAuth, TicketController.remove);

// Grupos: entrada/saida de atendentes
import * as TicketGroupController from "../controllers/TicketGroupController";
ticketRoutes.post("/tickets/:ticketId/join",  isAuth, TicketGroupController.join);
ticketRoutes.post("/tickets/:ticketId/leave", isAuth, TicketGroupController.leave);
ticketRoutes.get("/tickets/:ticketId/users",  isAuth, TicketGroupController.users);

export default ticketRoutes;
