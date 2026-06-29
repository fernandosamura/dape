import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";

export const getShieldConfig = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId } = req.params;
  const rows = await sequelize.query<any>(
    `SELECT * FROM daple_shield_config WHERE company_id = :cid AND whatsapp_id = :wid LIMIT 1`,
    { replacements: { cid: companyId, wid: whatsappId }, type: QueryTypes.SELECT }
  );
  return res.json(rows[0] ?? null);
};

export const upsertShieldConfig = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId } = req.params;
  const f = req.body;
  await sequelize.query(
    `INSERT INTO daple_shield_config
       (company_id, whatsapp_id, is_enabled, max_msgs_per_minute, max_msgs_per_hour,
        max_msgs_per_day, business_hours_start, business_hours_end, respect_business_hours,
        auto_quarantine_enabled, quarantine_threshold_min, quarantine_duration_min)
     VALUES (:cid, :wid, :enabled, :mpm, :mph, :mpd, :bhs, :bhe, :rbh, :aqe, :qtm, :qdm)
     ON CONFLICT (company_id, whatsapp_id) DO UPDATE SET
       is_enabled = EXCLUDED.is_enabled,
       max_msgs_per_minute = EXCLUDED.max_msgs_per_minute,
       max_msgs_per_hour = EXCLUDED.max_msgs_per_hour,
       max_msgs_per_day = EXCLUDED.max_msgs_per_day,
       business_hours_start = EXCLUDED.business_hours_start,
       business_hours_end = EXCLUDED.business_hours_end,
       respect_business_hours = EXCLUDED.respect_business_hours,
       auto_quarantine_enabled = EXCLUDED.auto_quarantine_enabled,
       quarantine_threshold_min = EXCLUDED.quarantine_threshold_min,
       quarantine_duration_min = EXCLUDED.quarantine_duration_min,
       updated_at = NOW()`,
    {
      replacements: {
        cid: companyId, wid: whatsappId,
        enabled: f.is_enabled ?? true,
        mpm: f.max_msgs_per_minute ?? 20,
        mph: f.max_msgs_per_hour ?? 200,
        mpd: f.max_msgs_per_day ?? 1000,
        bhs: f.business_hours_start || null,
        bhe: f.business_hours_end || null,
        rbh: f.respect_business_hours ?? false,
        aqe: f.auto_quarantine_enabled ?? true,
        qtm: f.quarantine_threshold_min ?? 5,
        qdm: f.quarantine_duration_min ?? 30,
      },
      type: QueryTypes.INSERT,
    }
  );
  return res.json({ ok: true });
};

export const getShieldAuditLog = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  const rows = await sequelize.query<any>(
    `SELECT * FROM daple_shield_audit_log
     WHERE company_id = :cid AND (:wid::int IS NULL OR whatsapp_id = :wid::int)
     ORDER BY created_at DESC LIMIT :lim OFFSET :off`,
    {
      replacements: { cid: companyId, wid: whatsappId || null, lim: Number(limit), off: Number(offset) },
      type: QueryTypes.SELECT,
    }
  );
  return res.json(rows);
};

export const getShieldStats = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const rows = await sequelize.query<any>(
    `SELECT
       whatsapp_id,
       COUNT(*) FILTER (WHERE decision='ALLOW') AS allowed,
       COUNT(*) FILTER (WHERE decision='BLOCK') AS blocked,
       COUNT(*) FILTER (WHERE block_reason='RATE_LIMIT') AS rate_limited,
       COUNT(*) FILTER (WHERE block_reason='QUOTA_EXCEEDED') AS quota_exceeded,
       COUNT(*) FILTER (WHERE block_reason='QUARANTINE') AS quarantined,
       DATE(created_at) AS date
     FROM daple_shield_audit_log
     WHERE company_id = :cid AND created_at >= NOW() - INTERVAL '7 days'
     GROUP BY whatsapp_id, DATE(created_at)
     ORDER BY date DESC`,
    { replacements: { cid: companyId }, type: QueryTypes.SELECT }
  );
  return res.json(rows);
};

export const getShieldStatus = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId } = req.params;
  const [config, countersRaw, quarantine] = await Promise.all([
    sequelize.query<any>(
      `SELECT * FROM daple_shield_config WHERE company_id = :cid AND whatsapp_id = :wid LIMIT 1`,
      { replacements: { cid: companyId, wid: whatsappId }, type: QueryTypes.SELECT }
    ),
    sequelize.query<any>(
      `SELECT window_type, count FROM daple_shield_counters
       WHERE whatsapp_id = :wid AND window_key >= :dayKey`,
      {
        replacements: { wid: whatsappId, dayKey: new Date().toISOString().substring(0, 10) },
        type: QueryTypes.SELECT,
      }
    ),
    sequelize.query<any>(
      `SELECT * FROM daple_shield_quarantine WHERE whatsapp_id = :wid AND quarantine_until > NOW() LIMIT 1`,
      { replacements: { wid: whatsappId }, type: QueryTypes.SELECT }
    ),
  ]);
  return res.json({
    config: config[0] ?? null,
    counters: countersRaw,
    quarantine: quarantine[0] ?? null,
  });
};

export const releaseQuarantine = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId } = req.params;
  await sequelize.query(
    `DELETE FROM daple_shield_quarantine WHERE whatsapp_id = :wid AND company_id = :cid`,
    { replacements: { wid: whatsappId, cid: companyId }, type: QueryTypes.DELETE }
  );
  return res.json({ ok: true });
};
