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
];

const MODULE_NAMES: Record<string, string> = {
  dape_pipeline:     'DAPE Pipeline',
  dape_analytics:    'DAPE Analytics',
  dape_ia:           'DAPE IA',
  dape_growth:       'DAPE Growth',
  dape_intelligence: 'DAPE Intelligence',
  dape_radar:        'DAPE Radar',
  async getPlanFeatures(companyId: number): Promise<{ use_facebook: boolean; use_instagram: boolean }> {
    const cacheKey = `plan_features:${companyId}`;
    const cached = cacheGet<{ use_facebook: boolean; use_instagram: boolean }>(cacheKey);
    if (cached) return cached;

    if (await isMasterCompany(companyId)) {
      const result = { use_facebook: true, use_instagram: true };
      cacheSet(cacheKey, result);
      return result;
    }

    const sql = `SELECT dp.use_facebook, dp.use_instagram
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
    };
    cacheSet(cacheKey, result);
    return result;
  },
};