import { Router } from 'express';
import { asyncWrapper as aw } from '@/helpers';
import { mfatotpGenerateHandler } from './totp-generate';

const router = Router();

router.get('/mfa/totp/generate', aw(mfatotpGenerateHandler));

const mfaRouter = router;
export { mfaRouter };
