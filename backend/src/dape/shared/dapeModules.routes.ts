import { Router, Request, Response } from 'express';
import { moduleAccessService } from '../shared/moduleAccess.service';
import isAuth from '../../middleware/isAuth';

const router = Router();

router.use(isAuth);

// GET /api/dape/modules/my-access — returns enabled modules for current tenant
router.get('/my-access', async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).user?.companyId;
    const enabledModules = await moduleAccessService.getEnabledModules(companyId);
    const allStatus = await moduleAccessService.getAllModulesStatus(companyId);
    res.json({ enabledModules, modules: allStatus });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar módulos' });
  }
});

export default router;
