import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../../database';
import { moduleAccessService } from '../shared/moduleAccess.service';

// ─── PLANS ───────────────────────────────────────────────────────────────────

export const listPlans = async (req: Request, res: Response) => {
  const plans = await sequelize.query(
    `SELECT p.*, 
       json_agg(json_build_object('module_key', pm.module_key, 'is_enabled', pm.is_enabled) ORDER BY pm.module_key) AS modules
     FROM dape_plans p
     LEFT JOIN dape_plan_modules pm ON pm.plan_id = p.id
     GROUP BY p.id
     ORDER BY p.id`,
    { type: QueryTypes.SELECT }
  );
  res.json(plans);
};

export const createPlan = async (req: Request, res: Response) => {
  const { name, slug, description, price_monthly, price_yearly, max_users, max_contacts, moduleKeys = [] } = req.body;
  const [plan] = await sequelize.query(
    `INSERT INTO dape_plans (name, slug, description, price_monthly, price_yearly, max_users, max_contacts)
     VALUES (:name, :slug, :description, :price_monthly, :price_yearly, :max_users, :max_contacts)
     RETURNING *`,
    { replacements: { name, slug, description, price_monthly, price_yearly, max_users, max_contacts }, type: QueryTypes.SELECT }
  ) as any[];

  if (moduleKeys.length > 0) {
    for (const mk of moduleKeys) {
      await sequelize.query(
        `INSERT INTO dape_plan_modules (plan_id, module_key, is_enabled) VALUES (:plan_id, :mk, TRUE) ON CONFLICT DO NOTHING`,
        { replacements: { plan_id: (plan as any).id, mk }, type: QueryTypes.INSERT }
      );
    }
  }
  res.status(201).json(plan);
};

export const updatePlan = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, price_monthly, price_yearly, max_users, max_contacts, is_active } = req.body;
  await sequelize.query(
    `UPDATE dape_plans SET name=:name, description=:description, price_monthly=:price_monthly,
     price_yearly=:price_yearly, max_users=:max_users, max_contacts=:max_contacts, is_active=:is_active, updated_at=NOW()
     WHERE id=:id`,
    { replacements: { id, name, description, price_monthly, price_yearly, max_users, max_contacts, is_active }, type: QueryTypes.UPDATE }
  );
  res.json({ ok: true });
};

export const updatePlanModules = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { modules } = req.body; // { dape_pipeline: true, dape_ia: false, ... }

  for (const [moduleKey, isEnabled] of Object.entries(modules)) {
    await sequelize.query(
      `INSERT INTO dape_plan_modules (plan_id, module_key, is_enabled)
       VALUES (:id, :moduleKey, :isEnabled)
       ON CONFLICT (plan_id, module_key) DO UPDATE SET is_enabled = :isEnabled`,
      { replacements: { id, moduleKey, isEnabled }, type: QueryTypes.INSERT }
    );
  }
  res.json({ ok: true });
};

// ─── TENANTS ─────────────────────────────────────────────────────────────────

export const listTenants = async (req: Request, res: Response) => {
  const tenants = await sequelize.query(
    `SELECT 
       c.id AS company_id, c.name AS company_name,
       dp.name AS plan_name, dp.slug AS plan_slug,
       tp.is_master, tp.is_active, tp.plan_ends_at,
       (SELECT COUNT(*) FROM dape_tenant_module_overrides WHERE company_id = c.id) AS override_count
     FROM "Companies" c
     LEFT JOIN dape_tenant_plans tp ON tp.company_id = c.id
     LEFT JOIN dape_plans dp ON dp.id = tp.plan_id
     ORDER BY c.id`,
    { type: QueryTypes.SELECT }
  );
  res.json(tenants);
};

export const getTenantDetail = async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const [company] = await sequelize.query(
    `SELECT c.id, c.name, tp.is_master, tp.is_active, tp.plan_ends_at, dp.name AS plan_name, dp.slug AS plan_slug
     FROM "Companies" c
     LEFT JOIN dape_tenant_plans tp ON tp.company_id = c.id
     LEFT JOIN dape_plans dp ON dp.id = tp.plan_id
     WHERE c.id = :companyId`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  ) as any[];

  const modules = await sequelize.query(
    `SELECT am.module_key, am.module_name, am.icon,
       COALESCE(ov.is_enabled, pm.is_enabled, FALSE) AS is_enabled,
       COALESCE(pm.is_enabled, FALSE) AS plan_enabled,
       ov.is_enabled AS override_enabled,
       (ov.id IS NOT NULL) AS has_override
     FROM dape_available_modules am
     LEFT JOIN dape_tenant_plans tp ON tp.company_id = :companyId
     LEFT JOIN dape_plan_modules pm ON pm.plan_id = tp.plan_id AND pm.module_key = am.module_key
     LEFT JOIN dape_tenant_module_overrides ov ON ov.company_id = :companyId AND ov.module_key = am.module_key
     WHERE am.is_active = TRUE ORDER BY am.sort_order`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );

  res.json({ company, modules });
};

export const assignPlan = async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const { planId, planEndsAt, notes } = req.body;
  await sequelize.query(
    `INSERT INTO dape_tenant_plans (company_id, plan_id, plan_ends_at, notes, is_active, is_master)
     VALUES (:companyId, :planId, :planEndsAt, :notes, TRUE, FALSE)
     ON CONFLICT (company_id) DO UPDATE SET plan_id=:planId, plan_ends_at=:planEndsAt, notes=:notes, is_active=TRUE, updated_at=NOW()`,
    { replacements: { companyId, planId, planEndsAt: planEndsAt || null, notes: notes || null }, type: QueryTypes.INSERT }
  );
  moduleAccessService.invalidateCache(Number(companyId));
  res.json({ ok: true });
};

export const overrideTenantModules = async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const { overrides } = req.body; // { dape_pipeline: true, dape_ia: false } or null to remove
  const userId = (req as any).user?.id;

  for (const [moduleKey, isEnabled] of Object.entries(overrides)) {
    if (isEnabled === null) {
      await sequelize.query(
        `DELETE FROM dape_tenant_module_overrides WHERE company_id=:companyId AND module_key=:moduleKey`,
        { replacements: { companyId, moduleKey }, type: QueryTypes.DELETE }
      );
    } else {
      await sequelize.query(
        `INSERT INTO dape_tenant_module_overrides (company_id, module_key, is_enabled, overridden_by)
         VALUES (:companyId, :moduleKey, :isEnabled, :userId)
         ON CONFLICT (company_id, module_key) DO UPDATE SET is_enabled=:isEnabled, overridden_by=:userId, updated_at=NOW()`,
        { replacements: { companyId, moduleKey, isEnabled, userId }, type: QueryTypes.INSERT }
      );
    }
  }
  moduleAccessService.invalidateCache(Number(companyId));
  res.json({ ok: true });
};

// ─── MONITORING ──────────────────────────────────────────────────────────────

export const getUsageReport = async (req: Request, res: Response) => {
  const stats = await sequelize.query(
    `SELECT module_key, COUNT(*) AS total_calls,
       SUM(CASE WHEN access_granted THEN 1 ELSE 0 END) AS granted,
       SUM(CASE WHEN NOT access_granted THEN 1 ELSE 0 END) AS denied
     FROM dape_module_access_log
     WHERE accessed_at >= NOW() - INTERVAL '30 days'
     GROUP BY module_key ORDER BY total_calls DESC`,
    { type: QueryTypes.SELECT }
  );
  res.json(stats);
};

export const getAccessLog = async (req: Request, res: Response) => {
  const { companyId, limit = 100 } = req.query;
  const logs = await sequelize.query(
    `SELECT l.*, c.name AS company_name
     FROM dape_module_access_log l
     LEFT JOIN "Companies" c ON c.id = l.company_id
     WHERE (:companyId::int IS NULL OR l.company_id = :companyId::int)
     ORDER BY l.accessed_at DESC
     LIMIT :limit`,
    { replacements: { companyId: companyId || null, limit }, type: QueryTypes.SELECT }
  );
  res.json(logs);
};

export const listAvailableModules = async (req: Request, res: Response) => {
  const modules = await sequelize.query(
    `SELECT * FROM dape_available_modules WHERE is_active = TRUE ORDER BY sort_order`,
    { type: QueryTypes.SELECT }
  );
  res.json(modules);
};
