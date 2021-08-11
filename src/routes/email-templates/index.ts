import { Router } from 'express';
import { createValidator } from 'express-joi-validation';

import { asyncWrapper as aw } from '@/helpers';
import { emailTemplatesSchema } from '@/validation';
import { emailTemplatesHandler } from './email-templates';

const router = Router();

router.post(
  '/email-templates',
  createValidator().body(emailTemplatesSchema),
  aw(emailTemplatesHandler)
);

const emailTemplatesRouter = router;
export { emailTemplatesRouter };
