import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import { processPaymentEvent } from "./billing.service";
import { billingQueue } from "../../queues";

const RELEVANT_EVENTS = new Set([
  "PAYMENT_CREATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
]);

/**
 * POST /webhooks/asaas
 *
 * Recebe eventos do Asaas, garante idempotência via dape_billing_events
 * e responde 200 imediatamente. O processamento pesado ocorre de forma assíncrona.
 */
export const handleAsaasWebhook = async (req: Request, res: Response) => {
  try {
    // 1. Validar token de autenticação do Asaas
    const asaasToken = req.headers["asaas-access-token"];
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (expectedToken && asaasToken !== expectedToken) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const event = req.body;
    const eventId = event?.id || event?.payment?.id;
    const eventType = event?.event;

    if (!eventId || !eventType) {
      return res.status(400).json({ error: "Payload inválido" });
    }

    // 2. Ignorar eventos não relevantes para billing
    if (!RELEVANT_EVENTS.has(eventType)) {
      return res.status(200).json({ status: "ignored" });
    }

    // 3 + 4. Idempotência DB-level: INSERT atômico com ON CONFLICT.
    // Se o evento já existir (gateway + event_id únicos via uq_billing_events_gateway_event),
    // DO NOTHING garante que não há duplicate e RETURNING retorna zero linhas.
    const inserted = await sequelize.query(
      `INSERT INTO dape_billing_events
         (gateway, event_id, event_type, asaas_payment_id, asaas_subscription_id,
          payload, processing_status, received_at)
       VALUES
         ('asaas', :eventId, :eventType, :paymentId, :subscriptionId,
          :payload, 'pending', NOW())
       ON CONFLICT ON CONSTRAINT uq_billing_events_gateway_event DO NOTHING
       RETURNING id`,
      {
        replacements: {
          eventId,
          eventType,
          paymentId: event?.payment?.id || null,
          subscriptionId: event?.payment?.subscription || null,
          payload: JSON.stringify(event),
        },
        type: QueryTypes.SELECT,
      }
    ) as any[];

    if (inserted.length === 0) {
      // Conflito: evento duplicado — responder 200 sem reprocessar
      return res.status(200).json({ status: "already_processed" });
    }

    // 5. Responder 200 imediatamente (Asaas exige resposta rápida)
    res.status(200).json({ status: "received" });

    // 6. Enfileira o processamento pesado com retry automático.
    // A fila persiste no Redis — sobrevive a restart do servidor.
    await billingQueue.add(
      "ProcessBillingEvent",
      { eventType, payment: event?.payment || {}, eventId },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { age: 60 * 60 * 24 * 7 }, // 7 dias
        removeOnFail: false,
      }
    );
  } catch (err: any) {
    console.error("[DAPLE Billing] handleAsaasWebhook error:", err);
    // Sempre responder 200 para o Asaas não reenviar em loop
    return res.status(200).json({ status: "error_logged" });
  }
};

/**
 * POST /webhooks/asaas/retry-pending
 * Endpoint interno para reprocessar eventos pendentes (usado pelo cron job)
 */
export const retryPendingEvents = async (req: Request, res: Response) => {
  try {
    const pendingEvents = await sequelize.query(
      `SELECT id, event_id, event_type, payload FROM dape_billing_events
       WHERE processing_status IN ('pending', 'error')
         AND received_at > NOW() - INTERVAL '7 days'
       ORDER BY received_at ASC LIMIT 50`,
      { type: QueryTypes.SELECT }
    ) as any[];

    let processed = 0;
    let errors = 0;

    for (const eventRecord of pendingEvents) {
      try {
        const payload = typeof (eventRecord as any).payload === "string"
          ? JSON.parse((eventRecord as any).payload)
          : (eventRecord as any).payload;

        await processPaymentEvent((eventRecord as any).event_type, payload?.payment || {});

        await sequelize.query(
          `UPDATE dape_billing_events SET processing_status = 'processed', processed_at = NOW() WHERE id = :id`,
          { replacements: { id: (eventRecord as any).id }, type: QueryTypes.UPDATE }
        );
        processed++;
      } catch (err: any) {
        await sequelize.query(
          `UPDATE dape_billing_events SET processing_status = 'error', processing_error = :error WHERE id = :id`,
          { replacements: { id: (eventRecord as any).id, error: err.message }, type: QueryTypes.UPDATE }
        ).catch(() => {});
        errors++;
      }
    }

    return res.json({ processed, errors, total: pendingEvents.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
