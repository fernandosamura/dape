import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import { moduleAccessService } from "../shared/moduleAccess.service";

// ─── UNIFIED PLANS ───────────────────────────────────────────────────────────

export const listUnifiedPlans = async (req: Request, res: Response) => {
  try {
    const plans = await sequelize.query(
      `SELECT 
        dp.id,
        dp.name,
        dp.slug,
        dp.description,
        dp.price_monthly AS price,
        dp.max_users,
        dp.max_contacts,
        
        dp.native_plan_id,
        dp.max_connections,
        dp.max_queues,
        dp.use_campaigns,
        dp.use_schedules,
        dp.use_internal_chat,
        dp.use_external_api,
        dp.use_kanban,
        dp.use_openai,
        dp.use_integrations,
        dp.use_facebook,
        dp.use_instagram,
        dp.allowed_ia_models,
        dp.use_ia_audio_reply,
        dp.is_master,
        dp.created_at,
        dp.updated_at,
        COALESCE(
          json_object_agg(dpm.module_key, dpm.is_enabled)
          FILTER (WHERE dpm.module_key IS NOT NULL),
          '{}'::json
        ) AS modules
      FROM dape_plans dp
      LEFT JOIN dape_plan_modules dpm ON dpm.plan_id = dp.id
      GROUP BY dp.id
      ORDER BY dp.price_monthly ASC NULLS FIRST`,
      { type: QueryTypes.SELECT }
    );
    return res.json(plans);
  } catch (err: any) {
    console.error("[DAPE] listUnifiedPlans error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const createUnifiedPlan = async (req: Request, res: Response) => {
  try {
    const {
      name, description, price,
      max_users, max_contacts,
      max_connections, max_queues,
      use_campaigns, use_schedules, use_internal_chat,
      use_external_api, use_kanban, use_openai, use_integrations,
      use_facebook, use_instagram,
      allowed_ia_models,
      use_ia_audio_reply,
      modules
    } = req.body;

    if (!name) return res.status(400).json({ error: "name é obrigatório" });

    const slug = (name as string).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    let uniqueSlug = slug || `plan_${Date.now()}`;
    const [existingSlug] = await sequelize.query(
      `SELECT id FROM dape_plans WHERE slug = :slug`,
      { replacements: { slug: uniqueSlug }, type: QueryTypes.SELECT }
    ) as any[];
    if (existingSlug) uniqueSlug = `${uniqueSlug}_${Date.now()}`;

    // 1. Create native Plan
    const [nativePlan] = await sequelize.query(
      `INSERT INTO "Plans" (name, users, connections, queues, value, "useCampaigns", "useSchedules", "useInternalChat", "useExternalApi", "useKanban", "useOpenAi", "useIntegrations", "useFacebook", "useInstagram", "createdAt", "updatedAt")
       VALUES (:name, :users, :connections, :queues, :value, :useCampaigns, :useSchedules, :useInternalChat, :useExternalApi, :useKanban, :useOpenAi, :useIntegrations, :useFacebook, :useInstagram, NOW(), NOW())
       RETURNING id`,
      {
        replacements: {
          name, users: max_users || 5,
          connections: max_connections || 3, queues: max_queues || 3,
          value: price || 0,
          useCampaigns: use_campaigns !== undefined ? use_campaigns : true,
          useSchedules: use_schedules !== undefined ? use_schedules : true,
          useInternalChat: use_internal_chat !== undefined ? use_internal_chat : true,
          useExternalApi: use_external_api !== undefined ? use_external_api : true,
          useKanban: use_kanban !== undefined ? use_kanban : true,
          useOpenAi: use_openai !== undefined ? use_openai : true,
          useIntegrations: use_integrations !== undefined ? use_integrations : true,
          useFacebook: use_facebook !== undefined ? use_facebook : true,
          useInstagram: use_instagram !== undefined ? use_instagram : true
        },
        type: QueryTypes.SELECT
      }
    ) as any[];

    const nativePlanId = (nativePlan as any).id;

    // 2. Create dape_plans record
    const iaModels = Array.isArray(allowed_ia_models) ? allowed_ia_models : [];
    const [dapePlan] = await sequelize.query(
      `INSERT INTO dape_plans (name, slug, description, price_monthly, max_users, max_contacts, max_connections, max_queues, use_campaigns, use_schedules, use_internal_chat, use_external_api, use_kanban, use_openai, use_integrations, use_facebook, use_instagram, allowed_ia_models, use_ia_audio_reply, native_plan_id, created_at, updated_at)
       VALUES (:name, :slug, :description, :price, :max_users, :max_contacts, :max_connections, :max_queues, :use_campaigns, :use_schedules, :use_internal_chat, :use_external_api, :use_kanban, :use_openai, :use_integrations, :use_facebook, :use_instagram, :allowed_ia_models, :use_ia_audio_reply, :native_plan_id, NOW(), NOW())
       RETURNING id`,
      {
        replacements: {
          name, slug: uniqueSlug, description: description || null, price: price || 0,
          max_users: max_users || 5, max_contacts: max_contacts || 1000,
          max_connections: max_connections || 3, max_queues: max_queues || 3,
          use_campaigns: use_campaigns || false, use_schedules: use_schedules || false,
          use_internal_chat: use_internal_chat || false, use_external_api: use_external_api || false,
          use_kanban: use_kanban || false, use_openai: use_openai || false,
          use_integrations: use_integrations || false,
          use_facebook: use_facebook !== undefined ? use_facebook : true,
          use_instagram: use_instagram !== undefined ? use_instagram : true,
          allowed_ia_models: JSON.stringify(iaModels),
          use_ia_audio_reply: use_ia_audio_reply || false,
          native_plan_id: nativePlanId
        },
        type: QueryTypes.SELECT
      }
    ) as any[];

    const dapePlanId = (dapePlan as any).id;

    // 3. Module associations
    if (modules && typeof modules === "object") {
      for (const [moduleKey, val] of Object.entries(modules)) {
        const isEnabled = typeof val === "object" && val !== null ? (val as any).is_enabled : val;
        const operationMode = typeof val === "object" && val !== null ? ((val as any).operation_mode || 'assisted') : 'assisted';
        await sequelize.query(
          `INSERT INTO dape_plan_modules (plan_id, module_key, is_enabled, operation_mode, created_at)
           VALUES (:planId, :moduleKey, :isEnabled, :operationMode, NOW())
           ON CONFLICT (plan_id, module_key) DO UPDATE SET is_enabled = :isEnabled, operation_mode = :operationMode`,
          { replacements: { planId: dapePlanId, moduleKey, isEnabled, operationMode }, type: QueryTypes.INSERT }
        );
      }
    }

    return res.status(201).json({ id: dapePlanId, native_plan_id: nativePlanId });
  } catch (err: any) {
    console.error("[DAPE] createUnifiedPlan error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const updateUnifiedPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name, description, price,
      max_users, max_contacts,
      max_connections, max_queues,
      use_campaigns, use_schedules, use_internal_chat,
      use_external_api, use_kanban, use_openai, use_integrations,
      use_facebook, use_instagram,
      allowed_ia_models,
      use_ia_audio_reply,
      modules
    } = req.body;

    const [existing] = await sequelize.query(
      `SELECT native_plan_id, is_master FROM dape_plans WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    ) as any[];

    const iaModels = Array.isArray(allowed_ia_models) ? allowed_ia_models : [];
    await sequelize.query(
      `UPDATE dape_plans SET name=:name, description=:description, price_monthly=:price,
       max_users=:max_users, max_contacts=:max_contacts,
       max_connections=:max_connections, max_queues=:max_queues,
       use_campaigns=:use_campaigns, use_schedules=:use_schedules, use_internal_chat=:use_internal_chat,
       use_external_api=:use_external_api, use_kanban=:use_kanban, use_openai=:use_openai,
       use_integrations=:use_integrations, use_facebook=:use_facebook, use_instagram=:use_instagram,
       allowed_ia_models=:allowed_ia_models, use_ia_audio_reply=:use_ia_audio_reply, updated_at=NOW()
       WHERE id=:id`,
      {
        replacements: {
          id, name, description: description || null, price: price || 0,
          max_users: max_users || 5, max_contacts: max_contacts || 1000,
          max_connections: max_connections || 3, max_queues: max_queues || 3,
          use_campaigns: use_campaigns || false, use_schedules: use_schedules || false,
          use_internal_chat: use_internal_chat || false, use_external_api: use_external_api || false,
          use_kanban: use_kanban || false, use_openai: use_openai || false,
          use_integrations: use_integrations || false,
          use_facebook: use_facebook !== undefined ? use_facebook : true,
          use_instagram: use_instagram !== undefined ? use_instagram : true,
          allowed_ia_models: JSON.stringify(iaModels),
          use_ia_audio_reply: use_ia_audio_reply || false
        },
        type: QueryTypes.UPDATE
      }
    );

    if ((existing as any)?.native_plan_id) {
      await sequelize.query(
        `UPDATE "Plans" SET name=:name, users=:users, connections=:connections, queues=:queues, value=:value,
         "useCampaigns"=:useCampaigns, "useSchedules"=:useSchedules, "useInternalChat"=:useInternalChat,
         "useExternalApi"=:useExternalApi, "useKanban"=:useKanban, "useOpenAi"=:useOpenAi,
         "useIntegrations"=:useIntegrations, "useFacebook"=:useFacebook, "useInstagram"=:useInstagram, "updatedAt"=NOW() WHERE id=:nativeId`,
        {
          replacements: {
            name, users: max_users || 5, connections: max_connections || 3, queues: max_queues || 3,
            value: price || 0,
            useCampaigns: use_campaigns || false, useSchedules: use_schedules || false,
            useInternalChat: use_internal_chat || false, useExternalApi: use_external_api || false,
            useKanban: use_kanban || false, useOpenAi: use_openai || false,
            useIntegrations: use_integrations || false,
            useFacebook: use_facebook !== undefined ? use_facebook : true,
            useInstagram: use_instagram !== undefined ? use_instagram : true,
            nativeId: (existing as any).native_plan_id
          },
          type: QueryTypes.UPDATE
        }
      );
    }

    if (modules && typeof modules === "object") {
      for (const [moduleKey, val] of Object.entries(modules)) {
        const isEnabled = typeof val === "object" && val !== null ? (val as any).is_enabled : val;
        const operationMode = typeof val === "object" && val !== null ? ((val as any).operation_mode || 'assisted') : 'assisted';
        await sequelize.query(
          `INSERT INTO dape_plan_modules (plan_id, module_key, is_enabled, operation_mode, created_at)
           VALUES (:planId, :moduleKey, :isEnabled, :operationMode, NOW())
           ON CONFLICT (plan_id, module_key) DO UPDATE SET is_enabled = :isEnabled, operation_mode = :operationMode`,
          { replacements: { planId: id, moduleKey, isEnabled, operationMode }, type: QueryTypes.INSERT }
        );
      }
    }

    const tenants = await sequelize.query(
      `SELECT company_id FROM dape_tenant_plans WHERE plan_id = :planId`,
      { replacements: { planId: id }, type: QueryTypes.SELECT }
    ) as any[];
    for (const t of tenants) {
      moduleAccessService.invalidateCache((t as any).company_id);
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[DAPE] updateUnifiedPlan error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const deleteUnifiedPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [planInfo] = await sequelize.query(
      `SELECT native_plan_id, is_master FROM dape_plans WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    ) as any[];

    if ((planInfo as any)?.is_master) {
      return res.status(403).json({ error: "Não é possível excluir o plano Master." });
    }

    const [usage] = await sequelize.query(
      `SELECT COUNT(*) as cnt FROM dape_tenant_plans WHERE plan_id = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    ) as any[];
    if (parseInt((usage as any)?.cnt || "0") > 0) {
      return res.status(400).json({ error: "Plano está em uso por uma ou mais empresas." });
    }

    await sequelize.query(`DELETE FROM dape_plan_modules WHERE plan_id = :id`, { replacements: { id }, type: QueryTypes.DELETE });
    await sequelize.query(`DELETE FROM dape_plans WHERE id = :id`, { replacements: { id }, type: QueryTypes.DELETE });

    if ((planInfo as any)?.native_plan_id) {
      const [nativeUsage] = await sequelize.query(
        `SELECT COUNT(*) as cnt FROM "Companies" WHERE "planId" = :nativeId`,
        { replacements: { nativeId: (planInfo as any).native_plan_id }, type: QueryTypes.SELECT }
      ) as any[];
      if (parseInt((nativeUsage as any)?.cnt || "0") === 0) {
        await sequelize.query(`DELETE FROM "Plans" WHERE id = :nativeId`, { replacements: { nativeId: (planInfo as any).native_plan_id }, type: QueryTypes.DELETE });
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[DAPE] deleteUnifiedPlan error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const listNativePlans = listUnifiedPlans;
export const createNativePlan = createUnifiedPlan;
export const updateNativePlan = updateUnifiedPlan;
export const removeNativePlan = deleteUnifiedPlan;

// ─── COMPANIES ───────────────────────────────────────────────────────────────

export const listCompanies = async (req: Request, res: Response) => {
  try {
    const companies = await sequelize.query(
      `SELECT 
        c.id, c.name, c.email, c."planId", c.phone, c.status, c."approved", c."dueDate", c."createdAt",
        dp.id AS dape_plan_id, dp.name AS plan_name, dp.price_monthly AS plan_price,
        dtp.is_master, dtp.plan_ends_at,
        (SELECT COUNT(*) FROM "Users" u WHERE u."companyId" = c.id) AS user_count
      FROM "Companies" c
      LEFT JOIN dape_tenant_plans dtp ON dtp.company_id = c.id
      LEFT JOIN dape_plans dp ON dp.id = dtp.plan_id
      ORDER BY c.id ASC`,
      { type: QueryTypes.SELECT }
    );
    return res.json(companies);
  } catch (err: any) {
    console.error("[DAPE] listCompanies error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const createCompany = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, status, dueDate, plan_id, admin_name, admin_email, admin_password } = req.body;

    if (!name || !email || !plan_id) {
      return res.status(400).json({ error: "name, email e plan_id são obrigatórios" });
    }

    const [dapePlan] = await sequelize.query(
      `SELECT id, native_plan_id FROM dape_plans WHERE id = :planId`,
      { replacements: { planId: plan_id }, type: QueryTypes.SELECT }
    ) as any[];
    if (!dapePlan) return res.status(404).json({ error: "Plano não encontrado" });

    const isActive = status !== "inactive";

    const [company] = await sequelize.query(
      `INSERT INTO "Companies" (name, email, phone, status, "dueDate", "planId", "createdAt", "updatedAt")
       VALUES (:name, :email, :phone, :status, :dueDate, :planId, NOW(), NOW()) RETURNING id`,
      {
        replacements: {
          name, email: email || null, phone: phone || null,
          status: isActive, dueDate: dueDate || null,
          planId: (dapePlan as any).native_plan_id || null
        },
        type: QueryTypes.SELECT
      }
    ) as any[];

    const companyId = (company as any).id;

    await sequelize.query(
      `INSERT INTO dape_tenant_plans (company_id, plan_id, is_master, plan_starts_at, plan_ends_at, created_at, updated_at)
       VALUES (:companyId, :planId, false, NOW(), :expiresAt, NOW(), NOW())`,
      { replacements: { companyId, planId: plan_id, expiresAt: dueDate || null }, type: QueryTypes.INSERT }
    );

    for (const s of [{ key: "userCreation", value: "false" }, { key: "enabled", value: "true" }]) {
      await sequelize.query(
        `INSERT INTO "Settings" (key, value, "companyId", "createdAt", "updatedAt") VALUES (:key, :value, :companyId, NOW(), NOW())`,
        { replacements: { ...s, companyId }, type: QueryTypes.INSERT }
      );
    }

    if (admin_email && admin_password) {
      const bcrypt = require("bcryptjs");
      const hashedPass = await bcrypt.hash(admin_password, 8);
      await sequelize.query(
        `INSERT INTO "Users" (name, email, "passwordHash", profile, "companyId", "tokenVersion", "createdAt", "updatedAt")
         VALUES (:name, :email, :passwordHash, 'admin', :companyId, 0, NOW(), NOW())`,
        { replacements: { name: admin_name || name, email: admin_email, passwordHash: hashedPass, companyId }, type: QueryTypes.INSERT }
      );
    }

    return res.status(201).json({ id: companyId });
  } catch (err: any) {
    console.error("[DAPE] createCompany error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const updateCompany = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phone, status, dueDate, plan_id } = req.body;

    const isActive = status !== "inactive" && status !== false;

    await sequelize.query(
      `UPDATE "Companies" SET name=:name, email=:email, phone=:phone, status=:status, "dueDate"=:dueDate, "updatedAt"=NOW() WHERE id=:id`,
      { replacements: { id, name, email: email || null, phone: phone || null, status: isActive, dueDate: dueDate || null }, type: QueryTypes.UPDATE }
    );

    if (plan_id) {
      const [dapePlan] = await sequelize.query(
        `SELECT id, native_plan_id FROM dape_plans WHERE id = :planId`,
        { replacements: { planId: plan_id }, type: QueryTypes.SELECT }
      ) as any[];

      if (dapePlan && (dapePlan as any).native_plan_id) {
        await sequelize.query(
          `UPDATE "Companies" SET "planId"=:nativePlanId WHERE id=:id`,
          { replacements: { nativePlanId: (dapePlan as any).native_plan_id, id }, type: QueryTypes.UPDATE }
        );
      }

      const [tenantPlan] = await sequelize.query(
        `SELECT id FROM dape_tenant_plans WHERE company_id = :companyId`,
        { replacements: { companyId: id }, type: QueryTypes.SELECT }
      ) as any[];

      if (tenantPlan) {
        await sequelize.query(
          `UPDATE dape_tenant_plans SET plan_id=:planId, plan_ends_at=:expiresAt, updated_at=NOW() WHERE company_id=:companyId`,
          { replacements: { planId: plan_id, expiresAt: dueDate || null, companyId: id }, type: QueryTypes.UPDATE }
        );
      } else {
        await sequelize.query(
          `INSERT INTO dape_tenant_plans (company_id, plan_id, is_master, plan_starts_at, plan_ends_at, created_at, updated_at) VALUES (:companyId, :planId, false, NOW(), :expiresAt, NOW(), NOW())`,
          { replacements: { companyId: id, planId: plan_id, expiresAt: dueDate || null }, type: QueryTypes.INSERT }
        );
      }

      moduleAccessService.invalidateCache(parseInt(id));
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[DAPE] updateCompany error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const removeCompany = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === 1) {
      return res.status(403).json({ error: "Não é possível excluir a empresa master." });
    }

    await sequelize.query(`DELETE FROM dape_tenant_plans WHERE company_id = :id`, { replacements: { id }, type: QueryTypes.DELETE });
    await sequelize.query(`DELETE FROM "Companies" WHERE id = :id`, { replacements: { id }, type: QueryTypes.DELETE });

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[DAPE] removeCompany error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ─── MODULE OVERRIDE ─────────────────────────────────────────────────────────
export const setModuleOverride = async (req: Request, res: Response) => {
  try {
    const { companyId, moduleKey, isEnabled, operationMode } = req.body;
    if (!companyId || !moduleKey) return res.status(400).json({ error: "companyId e moduleKey obrigatórios" });

    const mode = operationMode || 'assisted';
    await sequelize.query(
      `INSERT INTO dape_tenant_module_overrides (company_id, module_key, is_enabled, operation_mode, created_at, updated_at)
       VALUES (:cid, :key, :enabled, :mode, NOW(), NOW())
       ON CONFLICT (company_id, module_key) DO UPDATE SET is_enabled = :enabled, operation_mode = :mode, updated_at = NOW()`,
      { replacements: { cid: companyId, key: moduleKey, enabled: isEnabled, mode }, type: QueryTypes.INSERT }
    );
    moduleAccessService.invalidateCache(parseInt(companyId));
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[DAPE] setModuleOverride error:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const approveCompany = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await sequelize.query(
      `UPDATE "Companies" SET "approved" = true WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.UPDATE }
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
