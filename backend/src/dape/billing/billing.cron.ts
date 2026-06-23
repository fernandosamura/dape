import { enforceAccessJob } from "./billing.service";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import { processPaymentEvent } from "./billing.service";

/**
 * Cron Jobs do módulo de Billing
 *
 * Deve ser inicializado uma única vez na inicialização do servidor.
 * Usa setInterval nativo para não depender de pacotes externos.
 *
 * Jobs:
 * 1. enforceAccess — A cada hora: bloqueia empresas com grace period vencido
 * 2. processPendingEvents — A cada 5 minutos: reprocessa webhooks pendentes/com erro
 */

let initialized = false;

export function startBillingCrons(): void {
  if (initialized) return;
  initialized = true;

  // ─── Job 1: Enforce Access (a cada 1 hora) ────────────────────────────────
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(async () => {
    try {
      console.log("[DAPLE Billing] Rodando enforceAccessJob...");
      await enforceAccessJob();
    } catch (err: any) {
      console.error("[DAPLE Billing] enforceAccessJob error:", err.message);
    }
  }, ONE_HOUR);

  // Rodar imediatamente na inicialização também
  setTimeout(async () => {
    try {
      await enforceAccessJob();
    } catch (_e) {}
  }, 10000); // aguarda 10s para o banco estar pronto

  // ─── Job 2: Processar eventos pendentes (a cada 5 minutos) ────────────────
  const FIVE_MINUTES = 5 * 60 * 1000;
  setInterval(async () => {
    try {
      const pendingEvents = await sequelize.query(
        `SELECT id, event_id, event_type, payload FROM dape_billing_events
         WHERE processing_status IN ('pending', 'error')
           AND received_at > NOW() - INTERVAL '7 days'
         ORDER BY received_at ASC LIMIT 20`,
        { type: QueryTypes.SELECT }
      ) as any[];

      if (pendingEvents.length === 0) return;

      console.log(`[DAPLE Billing] Processando ${pendingEvents.length} eventos pendentes...`);

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
        } catch (err: any) {
          await sequelize.query(
            `UPDATE dape_billing_events SET processing_status = 'error', processing_error = :error WHERE id = :id`,
            { replacements: { id: (eventRecord as any).id, error: err.message }, type: QueryTypes.UPDATE }
          ).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error("[DAPLE Billing] processPendingEvents error:", err.message);
    }
  }, FIVE_MINUTES);

  console.log("[DAPLE Billing] Cron jobs iniciados ✅");
}
