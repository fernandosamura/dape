import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import {
  getTenantPlan,
  createSubscription,
  updateExtraUsers,
  cancelSubscription,
  checkCompanyAccess,
} from "./billing.service";

// ─── GET /billing/status ──────────────────────────────────────────────────────
// Retorna o status da assinatura da empresa logada
export const getSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user?.companyId;
    if (!companyId) return res.status(401).json({ error: "Não autenticado" });

    const tenantPlan = await getTenantPlan(companyId);
    if (!tenantPlan) return res.json({ hasSubscription: false });

    // Buscar última fatura pendente para exibir link de pagamento
    const [pendingInvoice] = await sequelize.query(
      `SELECT id, amount, due_date, status, invoice_url, pix_qr_code, pix_copy_paste
       FROM dape_billing_invoices
       WHERE company_id = :companyId AND status IN ('pending','overdue')
       ORDER BY due_date DESC LIMIT 1`,
      { replacements: { companyId }, type: QueryTypes.SELECT }
    ) as any[];

    return res.json({
      hasSubscription: true,
      plan: {
        id: tenantPlan.plan_id,
        name: tenantPlan.plan_name,
        price: tenantPlan.plan_price,
        maxUsers: tenantPlan.max_users,
        extraUserPrice: tenantPlan.extra_user_price,
      },
      subscription: {
        billingStatus: tenantPlan.billing_status,
        accessStatus: tenantPlan.access_status,
        billingType: tenantPlan.billing_type,
        extraUsersCount: tenantPlan.extra_users_count || 0,
        totalUsersAllowed: (tenantPlan.max_users || 5) + (tenantPlan.extra_users_count || 0),
        nextDueDate: tenantPlan.next_due_date,
        graceUntil: tenantPlan.grace_until,
        lastPaymentAt: tenantPlan.last_payment_at,
        cancelAtPeriodEnd: tenantPlan.cancel_at_period_end,
        currentPeriodEnd: tenantPlan.current_period_end,
        trialEndsAt: tenantPlan.trial_ends_at,
      },
      monthlyAmount:
        (parseFloat(tenantPlan.plan_price as any) || 0) +
        (tenantPlan.extra_users_count || 0) * (parseFloat(tenantPlan.extra_user_price as any) || 0),
      pendingInvoice: pendingInvoice || null,
    });
  } catch (err: any) {
    console.error("[DAPLE Billing] getSubscriptionStatus error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─── POST /billing/subscribe ──────────────────────────────────────────────────
// Cria uma nova assinatura (ou reativa uma existente)
export const subscribe = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user?.companyId;
    if (!companyId) return res.status(401).json({ error: "Não autenticado" });

    const { planId, billingType, cpfCnpj, phone, extraUsersCount } = req.body;
    if (!planId) return res.status(400).json({ error: "planId é obrigatório" });
    if (!billingType) return res.status(400).json({ error: "billingType é obrigatório" });

    // Buscar dados da empresa
    const [company] = await sequelize.query(
      `SELECT name, email FROM "Companies" WHERE id = :companyId`,
      { replacements: { companyId }, type: QueryTypes.SELECT }
    ) as any[];
    if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

    const result = await createSubscription({
      companyId,
      planId: parseInt(planId),
      billingType,
      companyName: (company as any).name,
      companyEmail: (company as any).email,
      cpfCnpj,
      phone,
      extraUsersCount: parseInt(extraUsersCount) || 0,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    console.error("[DAPLE Billing] subscribe error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─── PUT /billing/extra-users ─────────────────────────────────────────────────
// Altera a quantidade de usuários extras (self-service pelo admin da empresa)
export const updateExtraUsersHandler = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user?.companyId;
    const userId = (req as any).user?.id;
    const userProfile = (req as any).user?.profile;
    if (!companyId) return res.status(401).json({ error: "Não autenticado" });
    if (userProfile !== "admin") return res.status(403).json({ error: "Apenas administradores podem alterar usuários extras" });

    const { extraUsersCount } = req.body;
    if (extraUsersCount === undefined || extraUsersCount === null) {
      return res.status(400).json({ error: "extraUsersCount é obrigatório" });
    }

    const count = parseInt(extraUsersCount);
    if (isNaN(count) || count < 0) {
      return res.status(400).json({ error: "extraUsersCount deve ser um número inteiro não-negativo" });
    }

    const result = await updateExtraUsers({
      companyId,
      newExtraUsersCount: count,
      requestedByUserId: userId,
      requestedByRole: userProfile,
    });

    return res.json({
      success: true,
      extraUsersCount: count,
      newMonthlyAmount: result.newMonthlyAmount,
    });
  } catch (err: any) {
    console.error("[DAPLE Billing] updateExtraUsers error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─── POST /billing/cancel ─────────────────────────────────────────────────────
// Cancela a assinatura
export const cancelSubscriptionHandler = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user?.companyId;
    const userProfile = (req as any).user?.profile;
    if (!companyId) return res.status(401).json({ error: "Não autenticado" });
    if (userProfile !== "admin") return res.status(403).json({ error: "Apenas administradores podem cancelar a assinatura" });

    const { cancelAtPeriodEnd = true } = req.body;

    await cancelSubscription({ companyId, cancelAtPeriodEnd });

    return res.json({
      success: true,
      message: cancelAtPeriodEnd
        ? "Assinatura cancelada. Seu acesso continua até o fim do período pago."
        : "Assinatura cancelada imediatamente.",
    });
  } catch (err: any) {
    console.error("[DAPLE Billing] cancelSubscription error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─── GET /billing/invoices ────────────────────────────────────────────────────
// Lista faturas da empresa logada
export const listInvoices = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user?.companyId;
    if (!companyId) return res.status(401).json({ error: "Não autenticado" });

    const invoices = await sequelize.query(
      `SELECT id, amount, due_date, status, billing_type, invoice_url, pix_copy_paste, paid_at, confirmed_at
       FROM dape_billing_invoices
       WHERE company_id = :companyId
       ORDER BY due_date DESC LIMIT 24`,
      { replacements: { companyId }, type: QueryTypes.SELECT }
    );

    return res.json(invoices);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── GET /billing/access-check ────────────────────────────────────────────────
// Verifica se a empresa tem acesso (usado pelo middleware e pelo frontend)
export const accessCheck = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user?.companyId;
    if (!companyId) return res.status(401).json({ error: "Não autenticado" });

    const result = await checkCompanyAccess(companyId);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── GET /dape/master/billing/overview ───────────────────────────────────────
// Visão geral financeira para o painel Master
export const masterBillingOverview = async (req: Request, res: Response) => {
  try {
    const [summary] = await sequelize.query(
      `SELECT
         COUNT(*) FILTER (WHERE tp.billing_status = 'active') AS active_count,
         COUNT(*) FILTER (WHERE tp.billing_status = 'past_due') AS past_due_count,
         COUNT(*) FILTER (WHERE tp.billing_status = 'blocked') AS blocked_count,
         COUNT(*) FILTER (WHERE tp.billing_status = 'trialing') AS trialing_count,
         COUNT(*) FILTER (WHERE tp.billing_status = 'canceled') AS canceled_count,
         COALESCE(SUM(
           dp.price_monthly + (tp.extra_users_count * dp.extra_user_price)
         ) FILTER (WHERE tp.billing_status = 'active'), 0) AS mrr_estimated
       FROM dape_tenant_plans tp
       JOIN dape_plans dp ON dp.id = tp.plan_id
       WHERE tp.is_master = FALSE`,
      { type: QueryTypes.SELECT }
    ) as any[];

    const companies = await sequelize.query(
      `SELECT
         c.id, c.name, c.email,
         tp.billing_status, tp.access_status,
         tp.extra_users_count,
         tp.next_due_date, tp.grace_until, tp.blocked_at,
         tp.last_payment_at,
         dp.name AS plan_name,
         dp.price_monthly AS plan_price,
         dp.extra_user_price,
         (dp.price_monthly + (tp.extra_users_count * dp.extra_user_price)) AS monthly_amount
       FROM dape_tenant_plans tp
       JOIN "Companies" c ON c.id = tp.company_id
       JOIN dape_plans dp ON dp.id = tp.plan_id
       WHERE tp.is_master = FALSE
       ORDER BY tp.billing_status, c.name`,
      { type: QueryTypes.SELECT }
    );

    return res.json({ summary: summary || {}, companies });
  } catch (err: any) {
    console.error("[DAPLE Billing] masterBillingOverview error:", err);
    return res.status(500).json({ error: err.message });
  }
};
