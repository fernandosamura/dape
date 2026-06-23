import { Router } from "express";
import isAuth from "../../middleware/isAuth";
import { masterGuard } from "../shared/masterGuard.middleware";
import {
  getSubscriptionStatus,
  subscribe,
  updateExtraUsersHandler,
  cancelSubscriptionHandler,
  listInvoices,
  accessCheck,
  masterBillingOverview,
} from "./billing.controller";
import { handleAsaasWebhook, retryPendingEvents } from "./billingWebhook.controller";

const router = Router();

// ─── Rotas públicas (webhook do Asaas — sem autenticação) ─────────────────────
// IMPORTANTE: esta rota deve ser registrada ANTES do middleware isAuth no app principal
router.post("/webhooks/asaas", handleAsaasWebhook);

// ─── Rotas autenticadas (empresa logada) ──────────────────────────────────────
router.use(isAuth);

router.get("/status", getSubscriptionStatus);
router.post("/subscribe", subscribe);
router.put("/extra-users", updateExtraUsersHandler);
router.post("/cancel", cancelSubscriptionHandler);
router.get("/invoices", listInvoices);
router.get("/access-check", accessCheck);

// ─── Rotas Master (painel administrativo) ─────────────────────────────────────
router.get("/master/overview", masterGuard(), masterBillingOverview);
router.post("/master/retry-events", masterGuard(), retryPendingEvents);

export default router;
