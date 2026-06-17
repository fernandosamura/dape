import { Router } from 'express';
import isAuth from '../../middleware/isAuth';
import { masterGuard } from '../shared/masterGuard.middleware';
import * as controller from './dapeMaster.controller';
import * as unifiedCtrl from './dapeMasterNative.controller';

const router = Router();

router.use(isAuth);
router.use(masterGuard());

// ── Unified Plans (sistema + DAPE integrados) ─────────────────────────────────
router.get('/plans', unifiedCtrl.listUnifiedPlans);
router.post('/plans', unifiedCtrl.createUnifiedPlan);
router.put('/plans/:id', unifiedCtrl.updateUnifiedPlan);
router.delete('/plans/:id', unifiedCtrl.deleteUnifiedPlan);

// Module override per company
router.post('/module-override', unifiedCtrl.setModuleOverride);

// Available modules list
router.get('/available-modules', controller.listAvailableModules);

// Tenants
router.get('/tenants', controller.listTenants);
router.get('/tenants/:companyId', controller.getTenantDetail);
router.post('/tenants/:companyId/plan', controller.assignPlan);
router.put('/tenants/:companyId/modules', controller.overrideTenantModules);

// Monitoring
router.get('/usage', controller.getUsageReport);
router.get('/access-log', controller.getAccessLog);

// ── Companies nativas ─────────────────────────────────────────────────────────
router.get('/native/companies', unifiedCtrl.listCompanies);
router.post('/native/companies', unifiedCtrl.createCompany);
router.put('/native/companies/:id', unifiedCtrl.updateCompany);
router.delete('/native/companies/:id', unifiedCtrl.removeCompany);
router.put('/native/companies/:id/approve', unifiedCtrl.approveCompany);

// ── Plans nativas (aliases) ───────────────────────────────────────────────────
router.get('/native/plans', unifiedCtrl.listUnifiedPlans);
router.post('/native/plans', unifiedCtrl.createUnifiedPlan);
router.put('/native/plans/:id', unifiedCtrl.updateUnifiedPlan);
router.delete('/native/plans/:id', unifiedCtrl.deleteUnifiedPlan);

export default router;
