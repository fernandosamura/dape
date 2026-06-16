import { Router } from 'express';
import { getCompanies } from './company.controller';
import { authenticate } from '../../middlewares/auth';

const router = Router();

router.get('/', authenticate, getCompanies);

export default router;
