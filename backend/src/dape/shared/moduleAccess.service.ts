import { QueryTypes } from 'sequelize';
import sequelize from '../../database';

interface LogAccessParams {
  companyId: number;
  userId?: number;
  moduleKey: string;
  endpoint: string;
  accessGranted: boolean;
  reasonDenied?: string;
}

// Hardcoded list of all DAPE modules in display order
const ALL_DAPE_MODULES = [
  'dape_pipeline',
  'dape_analytics',
  'dape_ia',
  'dape_growth',
  'dape_intelligence',
  'dape_radar',
  'dape_shield',
];

const MODULE_NAMES: Record<string, string> = {
  dape_pipeline:     'DAPE Pipeline',
  dape_analytics:    'DAPE Analytics',
  dape_ia:           'DAPE IA',
  dape_growth:       'DAPE Growth',
  dape_intelligence: 'DAPE Intelligence',
  dape_radar:        'DAPE Radar',
  dape_shield:       'DAPLE Shield',
};

// Simple in-memory cache with TTL
const cache = new Map<string, { value: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) { cache.delete(key); return undefined; }
  return entry.value as T;
}

function cacheSet(key: string, value: any) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL });
}

async function isMasterCompany(companyId: number): Promise<boolean> {
  const rows = await sequelize.query<{ is_master: boolean }>(
    `SELECT is_master FROM dape_tenant_plans WHERE company_id = :companyId AND is_active = TRUE`,
    { replacements: { companyId }, type: QueryTypes.SELECT }
  );
  return rows[0]?.is_master === true;
}

export const moduleAccessService = {

  async checkAccess(companyId: number, moduleKey: string): Promise<boolean> {
    const cacheKey = `module_access:${companyId}:${moduleKey}`;
    const cached = cacheGet<boolean>(cacheKey);
    if (cached !== undefined) return cached;

    // 1. Check if master
    if (await isMasterCompany(companyId)) {
      cacheSet(cacheKey, true);
      return true;
    }

    // 2. Check override
    const override = await sequelize.query<{ is_enabled: boolean }>(
      `SELECT is_enabled FROM dape_tenant_module_overrides WHERE company_id = :companyId AND module_key = :moduleKey`,
      { replacements: { companyId, moduleKey }, type: QueryTypes.SELECT }
    );
    if (override.length > 0) {
      cacheSet(cacheKey, override[0].is_enabled);
      return override[0].is_enabled;
    }

    // 3. Check by plan
    const planCheck = await sequelize.query<{ is_enabled: boolean }>(
      `SELECT pm.is_enabled
       FROM dape_tenant_plans tp
       JOIN dape_plan_modules pm ON pm.plan_id = tp.plan_id
       WHERE tp.company_id = :companyId
         AND pm.module_key = :moduleKey
         AND tp.is_active = TRUE
         AND (tp.plan_ends_at IS NULL OR tp.plan_ends_at >= CURRENT_DATE)`,
      { replacements: { companyId, moduleKey }, type: QueryTypes.SELECT }
    );

    const hasAccess = planCheck[0]?.is_enabled === true;
    cacheSet(cacheKey, hasAccess);
    return hasAccess;
  },

  async getEnabledModules(companyId: number): Promise<string[]> {
    const cacheKey = `enabled_modules:${companyId}`;
    const cached = cacheGet<string[]>(cacheKey);
    if (cached) return cached;

    const checks = await Promise.all(
      ALL_DAPE_MODULES.map(async (key) => ({
        key,
        enabled: await this.checkAccess(companyId, key),
      }))
    );
    const enabled = checks.filter(r => r.enabled).map(r => r.key);
    cacheSet(cacheKey, enabled);
    return enabled;
  },

  async getAllModulesStatus(companyId: number): Promise<Array<{ module_key: string; module_name: string; is_enabled: boolean; from_override: boolean; operation_mode: 'disabled' | 'assisted' | 'automatic' }>> {
    if (await isMasterCompany(companyId)) {
      return ALL_DAPE_MODULES.map(key => ({
        module_key: key,
        module_name: MODULE_NAMES[key] || key,
        is_enabled: true,
        from_override: false,
        operation_mode: 'automatic' as const,
      }));
    }

    const overrides = await sequelize.query<{ module_key: string; is_enabled: boolean; operation_mode: string }>(
      `SELECT module_key, is_enabled, operation_mode FROM dape_tenant_module_overrides WHERE company_id = :companyId`,
      { replacements: { companyId }, type: QueryTypes.SELECT }
    );
    const overrideMap = new Map(overrides.map(r => [r.module_key, r]));

    const planModules = await sequelize.query<{ module_key: string; is_enabled: boolean; operation_mode: string }>(
      `SELECT pm.module_key, pm.is_enabled, pm.operation_mode
       FROM dape_tenant_plans tp
       JOIN dape_plan_modules pm ON pm.plan_id = tp.plan_id
       WHERE tp.company_id = :companyId AND tp.is_active = TRUE
         AND (tp.plan_ends_at IS NULL OR tp.plan_ends_at >= CURRENT_DATE)`,
      { replacements: { companyId }, type: QueryTypes.SELECT }
    );
    const planMap = new Map(planModules.map(r => [r.module_key, r]));

    return ALL_DAPE_MODULES.map(key => {
      const ov = overrideMap.get(key);
      const pm = planMap.get(key);
      const fromOverride = !!ov;
      const isEnabled = fromOverride ? ov!.is_enabled === true : pm?.is_enabled === true;
      const operationMode = (ov?.operation_mode || pm?.operation_mode || 'assisted') as 'disabled' | 'assisted' | 'automatic';
      return {
        module_key: key,
        module_name: MODULE_NAMES[key] || key,
        is_enabled: isEnabled,
        from_override: fromOverride,
        operation_mode: operationMode,
      };
    });
  },

  invalidateCache(companyId: number) {
    for (const key of cache.keys()) {
      if (key.includes(`:${companyId}:`)) cache.delete(key);
    }
    cache.delete(`enabled_modules:${companyId}`);
    cache.delete(`plan_features:${companyId}`);
  },

  async logAccess(params: LogAccessParams) {
    try {
      await sequelize.query(
        `INSERT INTO dape_module_access_log (company_id, user_id, module_key, endpoint, access_granted, reason_denied)
         VALUES (:companyId, :userId, :moduleKey, :endpoint, :accessGranted, :reasonDenied)`,
        { replacements: { ...params, userId: params.userId ?? null, reasonDenied: params.reasonDenied ?? null }, type: QueryTypes.INSERT }
      );
    } catch { /* log failure should not break the request */ }
  },

  async getPlanFeatures(companyId: number): Promise<{ use_facebook: boolean; use_instagram: boolean; allowedIaModels: string[]; use_ia_audio_reply: boolean }> {
    const cacheKey = `plan_features:${companyId}`;
    const cached = cacheGet<{ use_facebook: boolean; use_instagram: boolean; allowedIaModels: string[]; use_ia_audio_reply: boolean }>(cacheKey);
    if (cached) return cached;

    if (await isMasterCompany(companyId)) {
      const result = { use_facebook: true, use_instagram: true, allowedIaModels: [], use_ia_audio_reply: true };
      cacheSet(cacheKey, result);
      return result;
    }

    const sql = `SELECT dp.use_facebook, dp.use_instagram, dp.allowed_ia_models, dp.use_ia_audio_reply
       FROM dape_tenant_plans tp
       JOIN dape_plans dp ON dp.id = tp.plan_id
       WHERE tp.company_id = :companyId AND tp.is_active = TRUE
       LIMIT 1`;
    const rows = await sequelize.query<any>(
      sql,
      { replacements: { companyId }, type: QueryTypes.SELECT }
    );
    const result = {
      use_facebook: rows[0]?.use_facebook !== false,
      use_instagram: rows[0]?.use_instagram !== false,
      allowedIaModels: Array.isArray(rows[0]?.allowed_ia_models) ? rows[0].allowed_ia_models : [],
      use_ia_audio_reply: rows[0]?.use_ia_audio_reply === true,
    };
    cacheSet(cacheKey, result);
    return result;
  },
};
