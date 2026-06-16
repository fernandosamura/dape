import { saveSnapshot } from "./dapeAnalytics.service";
import sequelize from "../../database";
import { QueryTypes } from "sequelize";

let cronInterval: NodeJS.Timeout | null = null;

function getMillisUntil2359(): number {
  const now = new Date();
  const target = new Date();
  target.setHours(23, 59, 0, 0);
  if (target <= now) {
    // Already past 23:59 today — schedule for tomorrow
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

async function runDailySnapshot(): Promise<void> {
  try {
    // Get all companies with an active DAPE plan
    const companies = await sequelize.query<{ company_id: number }>(
      `SELECT DISTINCT tp.company_id
       FROM dape_tenant_plans tp
       JOIN dape_plan_modules pm ON pm.plan_id = tp.plan_id
       JOIN dape_available_modules am ON am.id = pm.module_id
       WHERE am.module_key = 'dape_analytics' AND pm.enabled = true`,
      { type: QueryTypes.SELECT }
    );

    for (const { company_id } of companies) {
      await saveSnapshot(company_id);
      console.info(`[DAPE Analytics Cron] Snapshot salvo para company_id=${company_id}`);
    }
  } catch (err) {
    console.error("[DAPE Analytics Cron] Erro no snapshot diário:", err);
  }

  // Schedule next run in 24h
  cronInterval = setTimeout(runDailySnapshot, 24 * 60 * 60 * 1000);
}

export function startAnalyticsCron(): void {
  const msUntil = getMillisUntil2359();
  const minutes = Math.round(msUntil / 60000);
  console.info(`[DAPE Analytics Cron] Próximo snapshot em ${minutes} minutos (23:59)`);

  cronInterval = setTimeout(() => {
    runDailySnapshot();
  }, msUntil);
}

export function stopAnalyticsCron(): void {
  if (cronInterval) {
    clearTimeout(cronInterval);
    cronInterval = null;
  }
}
