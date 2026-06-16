import { Router } from 'express';
import { getUsers } from './user.controller';
import { authenticate } from '../../middlewares/auth';

const router = Router();

router.get('/', authenticate, getUsers);

export default router;
