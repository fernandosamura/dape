import { Router } from 'express';
import dapeModulesRoutes from './shared/dapeModules.routes';
import dapeMasterRoutes from './master/dapeMaster.routes';
import dapePipelineRoutes from './pipeline/dapePipeline.routes';
import dapeAnalyticsRoutes from './analytics/dapeAnalytics.routes';
import dapeIARoutes from './ia/dapeIA.routes';
import dapeGrowthRoutes from './growth/dapeGrowth.routes';
import dapeIntelligenceRoutes from './intelligence/dapeIntelligence.routes';
import dapeRadarRoutes from './radar/dapeRadar.routes';

const router = Router();

router.use('/modules', dapeModulesRoutes);
router.use('/master', dapeMasterRoutes);
router.use('/pipeline', dapePipelineRoutes);
router.use('/analytics', dapeAnalyticsRoutes);
router.use('/ia', dapeIARoutes);
router.use('/growth', dapeGrowthRoutes);
router.use('/intelligence', dapeIntelligenceRoutes);
router.use('/radar', dapeRadarRoutes);

export default router;
