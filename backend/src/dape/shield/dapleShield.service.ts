import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import { logger } from "../../utils/logger";

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
  reason?: "RATE_LIMIT" | "QUOTA_EXCEEDED" | "BUSINESS_HOURS" | "QUARANTINE" | "DISABLED";
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

async function incrementCounters(whatsappId: number): Promise<void> {
  const now = new Date();
  const entries = [
    { type: "minute", key: now.toISOString().substring(0, 16) },
    { type: "hour",   key: now.toISOString().substring(0, 13) },
    { type: "day",    key: now.toISOString().substring(0, 10) },
  ];
  for (const e of entries) {
    await sequelize.query(
      `INSERT INTO daple_shield_counters (whatsapp_id, window_type, window_key, count, updated_at)
       VALUES (:wid, :type, :key, 1, NOW())
       ON CONFLICT (whatsapp_id, window_type, window_key)
       DO UPDATE SET count = daple_shield_counters.count + 1, updated_at = NOW()`,
      { replacements: { wid: whatsappId, type: e.type, key: e.key }, type: QueryTypes.INSERT }
    );
  }
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

      const counters = await getCounters(ctx.whatsappId);

      if (counters.minute >= config.max_msgs_per_minute) {
        await logDecision(ctx, { allowed: false, reason: "RATE_LIMIT" }, counters);
        return { allowed: false, reason: "RATE_LIMIT", msgsInLastMinute: counters.minute };
      }
      if (counters.hour >= config.max_msgs_per_hour) {
        await logDecision(ctx, { allowed: false, reason: "RATE_LIMIT" }, counters);
        return { allowed: false, reason: "RATE_LIMIT", msgsInLastHour: counters.hour };
      }
      if (counters.day >= config.max_msgs_per_day) {
        await logDecision(ctx, { allowed: false, reason: "QUOTA_EXCEEDED" }, counters);
        return { allowed: false, reason: "QUOTA_EXCEEDED", msgsToday: counters.day };
      }

      await incrementCounters(ctx.whatsappId);
      await logDecision(ctx, { allowed: true }, counters);
      return { allowed: true, msgsInLastMinute: counters.minute, msgsInLastHour: counters.hour, msgsToday: counters.day };
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
