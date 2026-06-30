import { QueryTypes } from "sequelize";
import cron from "node-cron";
import sequelize from "../../database";
import { logger } from "../../utils/logger";

// Cleanup diário: remove contadores antigos e audit_log com mais de 90 dias
cron.schedule("0 2 * * *", async () => {
  try {
    await sequelize.query(
      `DELETE FROM daple_shield_counters
       WHERE (window_type = 'minute' AND window_key < to_char(NOW() - INTERVAL '1 day', 'YYYY-MM-DD"T"HH24:MI'))
          OR (window_type = 'hour'   AND window_key < to_char(NOW() - INTERVAL '7 days', 'YYYY-MM-DD"T"HH24'))
          OR (window_type = 'day'    AND window_key < to_char(NOW() - INTERVAL '90 days', 'YYYY-MM-DD'))`,
      { type: QueryTypes.DELETE }
    );
    await sequelize.query(
      `DELETE FROM daple_shield_audit_log WHERE created_at < NOW() - INTERVAL '90 days'`,
      { type: QueryTypes.DELETE }
    );
  } catch (e: any) {
    logger.error({ err: e }, "Shield cleanup cron failed");
  }
});

export type MessageSource =
  | "manual"
  | "campaign"
  | "schedule"
  | "bot"
  | "integration"
  | "api"
  | "flow"
  | "typebot";

export interface ShieldContext {
  companyId: number;
  whatsappId: number;
  source: MessageSource;
  contactNumber?: string;
  messagePreview?: string;
  ticketId?: number;
}

export interface ShieldDecision {
  allowed: boolean;
  reason?: "RATE_LIMIT" | "QUOTA_EXCEEDED" | "BUSINESS_HOURS" | "QUARANTINE" | "DISABLED" | "DEGRADED_MODE";
  msgsInLastMinute?: number;
  msgsInLastHour?: number;
  msgsToday?: number;
}

async function getConfig(companyId: number, whatsappId: number): Promise<any | null> {
  const rows = await sequelize.query<any>(
    `SELECT * FROM daple_shield_config WHERE company_id = :companyId AND whatsapp_id = :whatsappId LIMIT 1`,
    { replacements: { companyId, whatsappId }, type: QueryTypes.SELECT }
  );
  return rows[0] ?? null;
}

async function isInQuarantine(whatsappId: number): Promise<boolean> {
  const rows = await sequelize.query<any>(
    `SELECT 1 FROM daple_shield_quarantine WHERE whatsapp_id = :wid AND quarantine_until > NOW() LIMIT 1`,
    { replacements: { wid: whatsappId }, type: QueryTypes.SELECT }
  );
  return rows.length > 0;
}

async function getCounters(whatsappId: number): Promise<{ minute: number; hour: number; day: number }> {
  const now = new Date();
  const minuteKey = now.toISOString().substring(0, 16);
  const hourKey   = now.toISOString().substring(0, 13);
  const dayKey    = now.toISOString().substring(0, 10);

  const rows = await sequelize.query<{ window_type: string; count: number }>(
    `SELECT window_type, count FROM daple_shield_counters
     WHERE whatsapp_id = :wid AND window_key IN (:minuteKey, :hourKey, :dayKey)`,
    { replacements: { wid: whatsappId, minuteKey, hourKey, dayKey }, type: QueryTypes.SELECT }
  );

  const get = (type: string) => rows.find(r => r.window_type === type)?.count ?? 0;
  return { minute: get("minute"), hour: get("hour"), day: get("day") };
}

// Retorna as janelas de tempo atuais para uso em compensação
function currentWindowKeys(): { minuteKey: string; hourKey: string; dayKey: string } {
  const now = new Date();
  return {
    minuteKey: now.toISOString().substring(0, 16),
    hourKey:   now.toISOString().substring(0, 13),
    dayKey:    now.toISOString().substring(0, 10),
  };
}

// Incrementa ANTES de verificar o limite (elimina race condition).
// Retorna os contadores APÓS o incremento, via RETURNING.
async function incrementCounters(whatsappId: number): Promise<{ minute: number; hour: number; day: number }> {
  const { minuteKey, hourKey, dayKey } = currentWindowKeys();

  const rows = await sequelize.query<{ window_type: string; count: number }>(
    `INSERT INTO daple_shield_counters (whatsapp_id, window_type, window_key, count, updated_at)
     VALUES
       (:wid, 'minute', :minuteKey, 1, NOW()),
       (:wid, 'hour',   :hourKey,   1, NOW()),
       (:wid, 'day',    :dayKey,    1, NOW())
     ON CONFLICT (whatsapp_id, window_type, window_key)
     DO UPDATE SET count = daple_shield_counters.count + 1, updated_at = NOW()
     RETURNING window_type, count`,
    { replacements: { wid: whatsappId, minuteKey, hourKey, dayKey }, type: QueryTypes.SELECT }
  );

  const get = (type: string) => Number(rows.find(r => r.window_type === type)?.count ?? 0);
  return { minute: get("minute"), hour: get("hour"), day: get("day") };
}

// Compensação: decrementa 1 unidade quando o limite foi ultrapassado pós-incremento.
async function decrementCounter(whatsappId: number, windowType: string, windowKey: string): Promise<void> {
  await sequelize.query(
    `UPDATE daple_shield_counters
     SET count = GREATEST(0, count - 1), updated_at = NOW()
     WHERE whatsapp_id = :wid AND window_type = :windowType AND window_key = :windowKey`,
    { replacements: { wid: whatsappId, windowType, windowKey }, type: QueryTypes.UPDATE }
  );
}

function isWithinBusinessHours(start: string, end: string): boolean {
  const now = new Date();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= sh * 60 + sm && nowMins <= eh * 60 + em;
}

async function logDecision(ctx: ShieldContext, decision: ShieldDecision, counters: { minute: number; hour: number; day: number }): Promise<void> {
  try {
    await sequelize.query(
      `INSERT INTO daple_shield_audit_log
         (company_id, whatsapp_id, source, ticket_id, contact_number, message_preview,
          decision, block_reason, msgs_in_last_minute, msgs_in_last_hour, msgs_today)
       VALUES (:cid, :wid, :src, :tid, :num, :preview, :dec, :reason, :m, :h, :d)`,
      {
        replacements: {
          cid: ctx.companyId, wid: ctx.whatsappId, src: ctx.source,
          tid: ctx.ticketId ?? null, num: ctx.contactNumber ?? null,
          preview: (ctx.messagePreview ?? "").substring(0, 200),
          dec: decision.allowed ? "ALLOW" : "BLOCK",
          reason: decision.reason ?? null,
          m: counters.minute, h: counters.hour, d: counters.day,
        },
        type: QueryTypes.INSERT,
      }
    );
  } catch (e) { /* log failure must not break send */ }
}

export const dapleShield = {
  async evaluate(ctx: ShieldContext): Promise<ShieldDecision> {
    try {
      const config = await getConfig(ctx.companyId, ctx.whatsappId);
      if (!config) return { allowed: true };

      if (!config.is_enabled) return { allowed: false, reason: "DISABLED" };

      if (config.auto_quarantine_enabled && await isInQuarantine(ctx.whatsappId)) {
        const counters = await getCounters(ctx.whatsappId);
        await logDecision(ctx, { allowed: false, reason: "QUARANTINE" }, counters);
        return { allowed: false, reason: "QUARANTINE" };
      }

      if (config.respect_business_hours && config.business_hours_start && config.business_hours_end) {
        if (!isWithinBusinessHours(config.business_hours_start, config.business_hours_end)) {
          const counters = await getCounters(ctx.whatsappId);
          await logDecision(ctx, { allowed: false, reason: "BUSINESS_HOURS" }, counters);
          return { allowed: false, reason: "BUSINESS_HOURS" };
        }
      }

      // ── Degraded mode check (antes do incremento, não consome quota) ──────
      if ((ctx.source === "campaign") && config?.is_enabled) {
        try {
          const risk = await calculateConnectionRisk(ctx.companyId, ctx.whatsappId);
          if (risk.level === "HIGH" || risk.level === "CRITICAL") {
            const counters = await getCounters(ctx.whatsappId);
            await logDecision(ctx, { allowed: false, reason: "DEGRADED_MODE" }, counters);
            return { allowed: false, reason: "DEGRADED_MODE" };
          }
        } catch { /* fail-open */ }
      }

      // ── Increment-first: incrementa ANTES de verificar o limite ──────────
      // Elimina a race condition: dois threads não conseguem mais passar ambos
      // quando o contador está em max-1. O que "ganhar" o incremento que passa
      // do limite recebe compensação (-1) e é bloqueado.
      const postCounters = await incrementCounters(ctx.whatsappId);
      const { minuteKey, hourKey, dayKey } = currentWindowKeys();

      if (postCounters.minute > config.max_msgs_per_minute) {
        await decrementCounter(ctx.whatsappId, "minute", minuteKey);
        const compensated = { ...postCounters, minute: postCounters.minute - 1 };
        await logDecision(ctx, { allowed: false, reason: "RATE_LIMIT" }, compensated);
        await dapleShield.reportSendError(ctx.whatsappId, ctx.companyId, "RATE_LIMIT_EXCEEDED");
        return { allowed: false, reason: "RATE_LIMIT", msgsInLastMinute: compensated.minute };
      }
      if (postCounters.hour > config.max_msgs_per_hour) {
        await decrementCounter(ctx.whatsappId, "hour", hourKey);
        const compensated = { ...postCounters, hour: postCounters.hour - 1 };
        await logDecision(ctx, { allowed: false, reason: "RATE_LIMIT" }, compensated);
        await dapleShield.reportSendError(ctx.whatsappId, ctx.companyId, "RATE_LIMIT_EXCEEDED");
        return { allowed: false, reason: "RATE_LIMIT", msgsInLastHour: compensated.hour };
      }
      if (postCounters.day > config.max_msgs_per_day) {
        await decrementCounter(ctx.whatsappId, "day", dayKey);
        const compensated = { ...postCounters, day: postCounters.day - 1 };
        await logDecision(ctx, { allowed: false, reason: "QUOTA_EXCEEDED" }, compensated);
        return { allowed: false, reason: "QUOTA_EXCEEDED", msgsToday: compensated.day };
      }

      // Repeated content detection (campaign and api sources)
      if ((ctx.source === "campaign" || ctx.source === "api") && ctx.messagePreview) {
        const repeated = await detectRepeatedContent(ctx.whatsappId, ctx.messagePreview);
        if (repeated) {
          try {
            await sequelize.query(
              `INSERT INTO daple_shield_audit_log (company_id, whatsapp_id, decision, block_reason, source, created_at)
               VALUES (:cid, :wid, 'ALLOW', 'REPEATED_CONTENT', :src, NOW())`,
              { replacements: { cid: ctx.companyId, wid: ctx.whatsappId, src: ctx.source || "unknown" }, type: QueryTypes.INSERT }
            );
          } catch { /* silent */ }
        }
      }

      await logDecision(ctx, { allowed: true }, postCounters);
      return { allowed: true, msgsInLastMinute: postCounters.minute, msgsInLastHour: postCounters.hour, msgsToday: postCounters.day };
    } catch (e) {
      logger.warn(`[DAPLE Shield] evaluate error — allowing by default: ${e}`);
      return { allowed: true }; // fail-open: never block due to shield internal error
    }
  },

  async reportSendError(whatsappId: number, companyId: number, errorMsg: string): Promise<void> {
    try {
      const config = await getConfig(companyId, whatsappId);
      if (!config?.auto_quarantine_enabled) return;

      const rows = await sequelize.query<any>(
        `SELECT COUNT(*)::int AS error_count FROM daple_shield_audit_log
         WHERE whatsapp_id = :wid AND decision = 'BLOCK' AND created_at >= NOW() - INTERVAL '5 minutes'`,
        { replacements: { wid: whatsappId }, type: QueryTypes.SELECT }
      );

      const errorCount = rows[0]?.error_count ?? 0;
      if (errorCount >= config.quarantine_threshold_min) {
        await sequelize.query(
          `INSERT INTO daple_shield_quarantine (whatsapp_id, company_id, quarantined_at, quarantine_until, reason, error_count)
           VALUES (:wid, :cid, NOW(), NOW() + (:dur || ' minutes')::interval, :reason, :cnt)
           ON CONFLICT (whatsapp_id) DO UPDATE
             SET quarantine_until = NOW() + (:dur || ' minutes')::interval,
                 reason = EXCLUDED.reason,
                 error_count = daple_shield_quarantine.error_count + 1`,
          {
            replacements: {
              wid: whatsappId, cid: companyId,
              dur: config.quarantine_duration_min,
              reason: errorMsg.substring(0, 200), cnt: errorCount,
            },
            type: QueryTypes.INSERT,
          }
        );
      }
    } catch (e) { /* silent */ }
  },

  async ensureDefaultConfig(companyId: number, whatsappId: number): Promise<void> {
    try {
      await sequelize.query(
        `INSERT INTO daple_shield_config (company_id, whatsapp_id) VALUES (:cid, :wid)
         ON CONFLICT (company_id, whatsapp_id) DO NOTHING`,
        { replacements: { cid: companyId, wid: whatsappId }, type: QueryTypes.INSERT }
      );
    } catch (e) { /* silent */ }
  },

  async getStatus(companyId: number, whatsappId: number): Promise<any> {
    const config = await getConfig(companyId, whatsappId);
    const counters = await getCounters(whatsappId);
    const inQuarantine = await isInQuarantine(whatsappId);
    return { config, counters, inQuarantine };
  },
};

// ── Feature 1: Safe Delay ──────────────────────────────────────────────────────

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(r => setTimeout(r, ms));
}

export async function applySafeDelay(source: MessageSource, companyId: number, whatsappId: number): Promise<void> {
  switch (source) {
    case "manual": return; // no delay
    case "campaign": return randomDelay(3000, 8000);
    case "bot":
    case "typebot": return randomDelay(1000, 4000);
    case "schedule": return randomDelay(2000, 6000);
    default: return randomDelay(1500, 5000);
  }
}

// ── Feature 2: Connection Risk Calculation ─────────────────────────────────────

export async function calculateConnectionRisk(
  companyId: number,
  whatsappId: number
): Promise<{ level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; score: number; reasons: string[] }> {
  try {
    const [configRows, quarantineRows, countersRaw, recentBlocks] = await Promise.all([
      sequelize.query<any>(
        `SELECT * FROM daple_shield_config WHERE company_id = :cid AND whatsapp_id = :wid LIMIT 1`,
        { replacements: { cid: companyId, wid: whatsappId }, type: QueryTypes.SELECT }
      ),
      sequelize.query<any>(
        `SELECT * FROM daple_shield_quarantine WHERE whatsapp_id = :wid AND quarantine_until > NOW() LIMIT 1`,
        { replacements: { wid: whatsappId }, type: QueryTypes.SELECT }
      ),
      sequelize.query<any>(
        `SELECT window_type, count FROM daple_shield_counters WHERE whatsapp_id = :wid AND window_key >= :dayKey`,
        { replacements: { wid: whatsappId, dayKey: new Date().toISOString().substring(0, 10) }, type: QueryTypes.SELECT }
      ),
      sequelize.query<any>(
        `SELECT COUNT(*) as cnt FROM daple_shield_audit_log
         WHERE whatsapp_id = :wid AND decision = 'BLOCK' AND created_at >= NOW() - INTERVAL '2 hours'`,
        { replacements: { wid: whatsappId }, type: QueryTypes.SELECT }
      ),
    ]);

    if (quarantineRows.length > 0) {
      return { level: "CRITICAL", score: 100, reasons: ["Em quarentena ativa"] };
    }

    const config = configRows[0];
    let score = 0;
    const reasons: string[] = [];

    if (config) {
      const dayCounter = countersRaw.find((c: any) => c.window_type === "day");
      const hourCounter = countersRaw.find((c: any) => c.window_type === "hour");
      const dayCount = dayCounter ? Number(dayCounter.count) : 0;
      const hourCount = hourCounter ? Number(hourCounter.count) : 0;
      const maxDay = Number(config.max_msgs_per_day) || 1000;
      const maxHour = Number(config.max_msgs_per_hour) || 200;

      const dayPct = maxDay > 0 ? (dayCount / maxDay) * 100 : 0;
      if (dayPct > 90) { score += 75; reasons.push(`Uso diário: ${dayPct.toFixed(0)}%`); }
      else if (dayPct > 75) { score += 50; reasons.push(`Uso diário: ${dayPct.toFixed(0)}%`); }
      else if (dayPct > 50) { score += 25; reasons.push(`Uso diário: ${dayPct.toFixed(0)}%`); }

      const hourPct = maxHour > 0 ? (hourCount / maxHour) * 100 : 0;
      if (hourPct > 80) { score += 20; reasons.push(`Uso por hora: ${hourPct.toFixed(0)}%`); }
    }

    const blockCount = Number(recentBlocks[0]?.cnt || 0);
    if (blockCount > 3) { score += 25; reasons.push(`${blockCount} bloqueios nas últimas 2h`); }
    else if (blockCount >= 1) { score += 10; reasons.push(`${blockCount} bloqueio(s) nas últimas 2h`); }

    score = Math.min(score, 100);
    const level = score <= 25 ? "LOW" : score <= 50 ? "MEDIUM" : score <= 75 ? "HIGH" : "CRITICAL";
    return { level, score, reasons };
  } catch {
    return { level: "LOW", score: 0, reasons: [] };
  }
}

// ── Feature 3: Repeated Content Detection (internal) ──────────────────────────

async function detectRepeatedContent(whatsappId: number, messagePreview?: string): Promise<boolean> {
  if (!messagePreview) return false;
  try {
    const rows = await sequelize.query<any>(
      `SELECT message_preview FROM daple_shield_audit_log
       WHERE whatsapp_id = :wid AND created_at >= NOW() - INTERVAL '10 minutes'
       ORDER BY created_at DESC LIMIT 20`,
      { replacements: { wid: whatsappId }, type: QueryTypes.SELECT }
    );
    const last5 = rows.slice(0, 5).map((r: any) => (r.message_preview || "").trim().toLowerCase());
    return last5.includes(messagePreview.trim().toLowerCase());
  } catch {
    return false;
  }
}
