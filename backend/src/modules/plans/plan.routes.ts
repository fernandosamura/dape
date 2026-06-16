import { Router } from 'express';
import { getPlans } from './plan.controller';
import { authenticate } from '../../middlewares/auth';

const router = Router();

router.get('/', authenticate, getPlans);

export default router;
