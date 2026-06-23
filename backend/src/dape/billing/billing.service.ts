import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import {
  createAsaasCustomer,
  findAsaasCustomerByEmail,
  createAsaasSubscription,
  updateAsaasSubscriptionValue,
  cancelAsaasSubscription,
  getAsaasPayment,
  getPixQrCode,
} from "./asaas.client";

// ─── Tipos internos ───────────────────────────────────────────────────────────

export interface TenantPlanRow {
  id: number;
  company_id: number;
  plan_id: number;
  billing_status: string;
  access_status: string;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  billing_type: string;
  extra_users_count: number;
  next_due_date: string | null;
  grace_until: string | null;
  last_payment_at: string | null;
  blocked_at: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  // Dados do plano (join)
  plan_name: string;
  plan_price: number;
  max_users: number;
  extra_user_price: number;
  grace_days: number;
  trial_days: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

function calculateMonthlyAmount(planPrice: number, extraUsersCount: number, extraUserPrice: number): number {
  return planPrice + extraUsersCount * extraUserPrice;
}

// ─── Consulta da assinatura ativa da empresa ──────────────────────────────────

export async function getTenantPlan(companyId: number): Promise<TenantPlanRow | null> {
  const [row] = await sequelize.query(
    `SELECT tp.*, dp.name AS plan_name, dp.price_monthly AS plan_price,
            dp.max_users, dp.extra_user_price, dp.grace_days, dp.trial_days
     FROM dape_tenant_plans tp
     JOIN dape_plans dp ON dp.id = tp.plan_id
     WHERE tp.company_id = :companyId`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  ) as TenantPlanRow[];
  return row || null;
}

// ─── Criar assinatura (novo cliente contratando) ──────────────────────────────

export async function createSubscription(params: {
  companyId: number;
  planId: number;
  billingType: "CREDIT_CARD" | "PIX" | "BOLETO";
  companyName: string;
  companyEmail: string;
  cpfCnpj?: string;
  phone?: string;
  extraUsersCount?: number;
}): Promise<{ tenantPlanId: number; firstInvoiceUrl?: string; pixQrCode?: string; pixCopyPaste?: string }> {
  const { companyId, planId, billingType, companyName, companyEmail, cpfCnpj, phone, extraUsersCount = 0 } = params;

  // 1. Buscar dados do plano
  const [plan] = await sequelize.query(
    `SELECT id, name, price_monthly, extra_user_price, trial_days, grace_days, max_users
     FROM dape_plans WHERE id = :planId`,
    { replacements: { planId }, type: QueryTypes.SELECT }
  ) as any[];

  if (!plan) throw new Error("Plano não encontrado");

  const monthlyAmount = calculateMonthlyAmount(
    parseFloat(plan.price_monthly) || 0,
    extraUsersCount,
    parseFloat(plan.extra_user_price) || 0
  );

  // 2. Garantir customer no Asaas
  let asaasCustomerId: string;
  const existingCustomer = await findAsaasCustomerByEmail(companyEmail);
  if (existingCustomer) {
    asaasCustomerId = existingCustomer.id;
  } else {
    const newCustomer = await createAsaasCustomer({
      name: companyName,
      email: companyEmail,
      cpfCnpj,
      phone,
      externalReference: `daple_company_${companyId}`,
    });
    asaasCustomerId = newCustomer.id;
  }

  // 3. Calcular data de início (trial ou imediato)
  const trialDays = parseInt(plan.trial_days) || 0;
  const today = new Date();
  const nextDueDate = trialDays > 0 ? addDays(today, trialDays) : today;
  const initialStatus = trialDays > 0 ? "trialing" : "pending_first_payment";
  const initialAccessStatus = trialDays > 0 ? "allowed" : "allowed"; // libera para ambos por ora
  const trialEndsAt = trialDays > 0 ? addDays(today, trialDays) : null;

  // 4. Criar assinatura no Asaas
  const asaasSub = await createAsaasSubscription({
    customerId: asaasCustomerId,
    billingType,
    value: monthlyAmount,
    nextDueDate: toDateStr(nextDueDate),
    description: `Assinatura DAPLE — Plano ${plan.name}`,
    externalReference: `daple_company_${companyId}`,
  });

  // 5. Salvar/atualizar assinatura local
  const [existingTenantPlan] = await sequelize.query(
    `SELECT id FROM dape_tenant_plans WHERE company_id = :companyId`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  ) as any[];

  let tenantPlanId: number;

  if (existingTenantPlan) {
    await sequelize.query(
      `UPDATE dape_tenant_plans SET
         plan_id = :planId,
         billing_status = :billingStatus,
         access_status = :accessStatus,
         asaas_customer_id = :customerId,
         asaas_subscription_id = :subscriptionId,
         billing_type = :billingType,
         extra_users_count = :extraUsers,
         next_due_date = :nextDueDate,
         trial_ends_at = :trialEndsAt,
         current_period_start = NOW(),
         current_period_end = :periodEnd,
         blocked_at = NULL,
         grace_until = NULL,
         cancel_at_period_end = FALSE,
         canceled_at = NULL,
         updated_at = NOW()
       WHERE company_id = :companyId`,
      {
        replacements: {
          planId,
          billingStatus: initialStatus,
          accessStatus: initialAccessStatus,
          customerId: asaasCustomerId,
          subscriptionId: asaasSub.id,
          billingType,
          extraUsers: extraUsersCount,
          nextDueDate: toDateStr(nextDueDate),
          trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
          periodEnd: addDays(nextDueDate, 30).toISOString(),
          companyId,
        },
        type: QueryTypes.UPDATE,
      }
    );
    tenantPlanId = (existingTenantPlan as any).id;
  } else {
    const [inserted] = await sequelize.query(
      `INSERT INTO dape_tenant_plans
         (company_id, plan_id, is_master, billing_status, access_status,
          asaas_customer_id, asaas_subscription_id, billing_type,
          extra_users_count, next_due_date, trial_ends_at,
          current_period_start, current_period_end,
          plan_starts_at, created_at, updated_at)
       VALUES
         (:companyId, :planId, false, :billingStatus, :accessStatus,
          :customerId, :subscriptionId, :billingType,
          :extraUsers, :nextDueDate, :trialEndsAt,
          NOW(), :periodEnd,
          NOW(), NOW(), NOW())
       RETURNING id`,
      {
        replacements: {
          companyId, planId,
          billingStatus: initialStatus,
          accessStatus: initialAccessStatus,
          customerId: asaasCustomerId,
          subscriptionId: asaasSub.id,
          billingType,
          extraUsers: extraUsersCount,
          nextDueDate: toDateStr(nextDueDate),
          trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
          periodEnd: addDays(nextDueDate, 30).toISOString(),
        },
        type: QueryTypes.SELECT,
      }
    ) as any[];
    tenantPlanId = (inserted as any).id;
  }

  // 6. Buscar link de pagamento da primeira fatura (se não for trial)
  let firstInvoiceUrl: string | undefined;
  let pixQrCode: string | undefined;
  let pixCopyPaste: string | undefined;

  if (trialDays === 0 && billingType === "PIX") {
    try {
      // Aguardar um momento para o Asaas gerar a primeira cobrança
      await new Promise(r => setTimeout(r, 2000));
      const { encodedImage, payload } = await getPixQrCode(asaasSub.id);
      pixQrCode = encodedImage;
      pixCopyPaste = payload;
    } catch (_e) {
      // Não bloquear o fluxo se o QR Code não estiver disponível imediatamente
    }
  }

  return { tenantPlanId, firstInvoiceUrl, pixQrCode, pixCopyPaste };
}

// ─── Alterar quantidade de usuários extras ────────────────────────────────────

export async function updateExtraUsers(params: {
  companyId: number;
  newExtraUsersCount: number;
  requestedByUserId: number;
  requestedByRole: string;
}): Promise<{ newMonthlyAmount: number }> {
  const { companyId, newExtraUsersCount, requestedByUserId, requestedByRole } = params;

  if (newExtraUsersCount < 0) throw new Error("Quantidade de usuários extras não pode ser negativa");

  const tenantPlan = await getTenantPlan(companyId);
  if (!tenantPlan) throw new Error("Empresa não possui assinatura ativa");
  if (!tenantPlan.asaas_subscription_id) throw new Error("Assinatura Asaas não encontrada");

  const newMonthlyAmount = calculateMonthlyAmount(
    parseFloat(tenantPlan.plan_price as any) || 0,
    newExtraUsersCount,
    parseFloat(tenantPlan.extra_user_price as any) || 0
  );

  // 1. Atualizar valor da assinatura no Asaas
  await updateAsaasSubscriptionValue(tenantPlan.asaas_subscription_id, newMonthlyAmount);

  // 2. Atualizar no banco local
  const previousCount = tenantPlan.extra_users_count || 0;
  await sequelize.query(
    `UPDATE dape_tenant_plans SET extra_users_count = :count, updated_at = NOW() WHERE company_id = :companyId`,
    { replacements: { count: newExtraUsersCount, companyId }, type: QueryTypes.UPDATE }
  );

  // 3. Registrar histórico
  const action = newExtraUsersCount > previousCount ? "add" : "remove";
  await sequelize.query(
    `INSERT INTO dape_extra_user_requests
       (company_id, tenant_plan_id, previous_extra_users, new_extra_users, action,
        requested_by_user_id, requested_by_role, unit_price_at_time, new_monthly_amount, created_at)
     VALUES
       (:companyId, :tenantPlanId, :prev, :next, :action,
        :userId, :role, :unitPrice, :newAmount, NOW())`,
    {
      replacements: {
        companyId,
        tenantPlanId: tenantPlan.id,
        prev: previousCount,
        next: newExtraUsersCount,
        action,
        userId: requestedByUserId,
        role: requestedByRole,
        unitPrice: parseFloat(tenantPlan.extra_user_price as any) || 0,
        newAmount: newMonthlyAmount,
      },
      type: QueryTypes.INSERT,
    }
  );

  return { newMonthlyAmount };
}

// ─── Cancelar assinatura ──────────────────────────────────────────────────────

export async function cancelSubscription(params: {
  companyId: number;
  cancelAtPeriodEnd: boolean;
}): Promise<void> {
  const { companyId, cancelAtPeriodEnd } = params;

  const tenantPlan = await getTenantPlan(companyId);
  if (!tenantPlan) throw new Error("Empresa não possui assinatura ativa");

  if (cancelAtPeriodEnd) {
    // Marca para cancelar no fim do ciclo, mantém acesso
    await sequelize.query(
      `UPDATE dape_tenant_plans SET cancel_at_period_end = TRUE, updated_at = NOW() WHERE company_id = :companyId`,
      { replacements: { companyId }, type: QueryTypes.UPDATE }
    );
    // Cancela no Asaas (não vai gerar novas cobranças)
    if (tenantPlan.asaas_subscription_id) {
      await cancelAsaasSubscription(tenantPlan.asaas_subscription_id);
    }
  } else {
    // Cancelamento imediato
    if (tenantPlan.asaas_subscription_id) {
      await cancelAsaasSubscription(tenantPlan.asaas_subscription_id);
    }
    await sequelize.query(
      `UPDATE dape_tenant_plans SET
         billing_status = 'canceled',
         access_status = 'blocked',
         canceled_at = NOW(),
         cancel_at_period_end = FALSE,
         updated_at = NOW()
       WHERE company_id = :companyId`,
      { replacements: { companyId }, type: QueryTypes.UPDATE }
    );
  }
}

// ─── Processar evento de pagamento (chamado pelo webhook processor) ───────────

export async function processPaymentEvent(eventType: string, payment: any): Promise<void> {
  const asaasSubscriptionId = payment?.subscription;
  if (!asaasSubscriptionId) return;

  const [tenantPlan] = await sequelize.query(
    `SELECT * FROM dape_tenant_plans WHERE asaas_subscription_id = :subId`,
    { replacements: { subId: asaasSubscriptionId }, type: QueryTypes.SELECT }
  ) as any[];

  if (!tenantPlan) {
    console.warn(`[DAPLE Billing] Assinatura não encontrada: ${asaasSubscriptionId}`);
    return;
  }

  const companyId = (tenantPlan as any).company_id;
  const tenantPlanId = (tenantPlan as any).id;
  const graceDays = (tenantPlan as any).grace_days || 3;

  // Upsert da fatura
  await sequelize.query(
    `INSERT INTO dape_billing_invoices
       (company_id, tenant_plan_id, asaas_payment_id, asaas_subscription_id,
        amount, due_date, billing_type, invoice_url, raw_payload, status, event_origin, created_at, updated_at)
     VALUES
       (:companyId, :tenantPlanId, :paymentId, :subscriptionId,
        :amount, :dueDate, :billingType, :invoiceUrl, :rawPayload, :status, 'webhook', NOW(), NOW())
     ON CONFLICT (asaas_payment_id) DO UPDATE SET
       status = :status,
       invoice_url = COALESCE(:invoiceUrl, dape_billing_invoices.invoice_url),
       raw_payload = :rawPayload,
       updated_at = NOW()`,
    {
      replacements: {
        companyId,
        tenantPlanId,
        paymentId: payment.id,
        subscriptionId: asaasSubscriptionId,
        amount: payment.value || 0,
        dueDate: payment.dueDate,
        billingType: payment.billingType || null,
        invoiceUrl: payment.invoiceUrl || null,
        rawPayload: JSON.stringify(payment),
        status: mapPaymentStatus(eventType),
      },
      type: QueryTypes.INSERT,
    }
  );

  // Atualizar status da assinatura conforme o evento
  switch (eventType) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      const dueDate = payment.dueDate ? new Date(payment.dueDate) : new Date();
      const nextDue = addDays(dueDate, 30);
      await sequelize.query(
        `UPDATE dape_tenant_plans SET
           billing_status = 'active',
           access_status = 'allowed',
           last_payment_at = NOW(),
           blocked_at = NULL,
           grace_until = NULL,
           next_due_date = :nextDue,
           current_period_start = :periodStart,
           current_period_end = :periodEnd,
           updated_at = NOW()
         WHERE company_id = :companyId`,
        {
          replacements: {
            nextDue: toDateStr(nextDue),
            periodStart: dueDate.toISOString(),
            periodEnd: nextDue.toISOString(),
            companyId,
          },
          type: QueryTypes.UPDATE,
        }
      );
      break;
    }

    case "PAYMENT_OVERDUE": {
      const dueDate = payment.dueDate ? new Date(payment.dueDate) : new Date();
      const graceUntil = addDays(dueDate, graceDays);
      await sequelize.query(
        `UPDATE dape_tenant_plans SET
           billing_status = 'past_due',
           access_status = 'grace',
           grace_until = :graceUntil,
           updated_at = NOW()
         WHERE company_id = :companyId`,
        {
          replacements: { graceUntil: graceUntil.toISOString(), companyId },
          type: QueryTypes.UPDATE,
        }
      );
      break;
    }

    case "PAYMENT_DELETED":
    case "PAYMENT_REFUNDED": {
      // Apenas registra — não altera acesso automaticamente
      await sequelize.query(
        `UPDATE dape_billing_invoices SET updated_at = NOW() WHERE asaas_payment_id = :paymentId`,
        { replacements: { paymentId: payment.id }, type: QueryTypes.UPDATE }
      );
      break;
    }
  }
}

function mapPaymentStatus(eventType: string): string {
  const map: Record<string, string> = {
    PAYMENT_CREATED: "pending",
    PAYMENT_CONFIRMED: "confirmed",
    PAYMENT_RECEIVED: "received",
    PAYMENT_OVERDUE: "overdue",
    PAYMENT_DELETED: "deleted",
    PAYMENT_REFUNDED: "refunded",
  };
  return map[eventType] || "pending";
}

// ─── Job: bloquear empresas com grace period vencido ─────────────────────────

export async function enforceAccessJob(): Promise<void> {
  const overdueCompanies = await sequelize.query(
    `SELECT company_id FROM dape_tenant_plans
     WHERE billing_status = 'past_due'
       AND grace_until IS NOT NULL
       AND grace_until < NOW()`,
    { type: QueryTypes.SELECT }
  ) as any[];

  for (const row of overdueCompanies) {
    await sequelize.query(
      `UPDATE dape_tenant_plans SET
         billing_status = 'blocked',
         access_status = 'blocked',
         blocked_at = NOW(),
         updated_at = NOW()
       WHERE company_id = :companyId`,
      { replacements: { companyId: (row as any).company_id }, type: QueryTypes.UPDATE }
    );
    console.log(`[DAPLE Billing] Empresa ${(row as any).company_id} bloqueada por inadimplência`);
  }

  // Cancelar assinaturas marcadas para cancelar ao fim do ciclo
  const toCancel = await sequelize.query(
    `SELECT company_id FROM dape_tenant_plans
     WHERE cancel_at_period_end = TRUE
       AND current_period_end IS NOT NULL
       AND current_period_end < NOW()
       AND billing_status != 'canceled'`,
    { type: QueryTypes.SELECT }
  ) as any[];

  for (const row of toCancel) {
    await sequelize.query(
      `UPDATE dape_tenant_plans SET
         billing_status = 'canceled',
         access_status = 'blocked',
         canceled_at = NOW(),
         updated_at = NOW()
       WHERE company_id = :companyId`,
      { replacements: { companyId: (row as any).company_id }, type: QueryTypes.UPDATE }
    );
    console.log(`[DAPLE Billing] Empresa ${(row as any).company_id} cancelada ao fim do ciclo`);
  }
}

// ─── Verificação de acesso (middleware helper) ────────────────────────────────

export async function checkCompanyAccess(companyId: number): Promise<{
  allowed: boolean;
  status: string;
  accessStatus: string;
  graceDaysLeft?: number;
}> {
  const [row] = await sequelize.query(
    `SELECT billing_status, access_status, grace_until
     FROM dape_tenant_plans WHERE company_id = :companyId`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  ) as any[];

  if (!row) {
    // Empresa sem assinatura registrada — permitir acesso (pode ser empresa antiga)
    return { allowed: true, status: "no_subscription", accessStatus: "allowed" };
  }

  const accessStatus = (row as any).access_status || "allowed";
  const billingStatus = (row as any).billing_status || "active";
  const graceUntil = (row as any).grace_until ? new Date((row as any).grace_until) : null;

  let graceDaysLeft: number | undefined;
  if (graceUntil) {
    const diff = graceUntil.getTime() - Date.now();
    graceDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return {
    allowed: accessStatus === "allowed" || accessStatus === "grace",
    status: billingStatus,
    accessStatus,
    graceDaysLeft,
  };
}
