import { Router } from 'express';
import { createValidator } from 'express-joi-validation';

import { asyncWrapper as aw } from '@/helpers';
import { tokenSchema } from '@/validation';
import { tokenHandler } from './token';

const router = Router();

router.post('/token', createValidator().body(tokenSchema), aw(tokenHandler));

const tokenRouter = router;
export { tokenRouter };
