import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { PasswordLessEmailBody, PasswordLessSmsBody } from '@/types';
import { signInPasswordlessStartEmailHandler } from './start-email';
import { signInPasswordlessStartSmsHandler } from './start-sms';

type BodyType = PasswordLessEmailBody | PasswordLessSmsBody;

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signInPasswordlessStartHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { body } = req;

  if (body.connection === 'email') {
    return signInPasswordlessStartEmailHandler(body, res);
  } else if (body.connection === 'sms') {
    return signInPasswordlessStartSmsHandler(body, res);
  }
};
