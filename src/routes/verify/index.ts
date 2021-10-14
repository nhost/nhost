import { Router } from 'express';
// import { createValidator } from 'express-joi-validation';

import { asyncWrapper as aw } from '@/helpers';
// import { tokenSchema } from '@/validation';
import { verifyHandler } from './verify';

const router = Router();

router.get('/verify', aw(verifyHandler));

const verifyRouter = router;
export { verifyRouter };
