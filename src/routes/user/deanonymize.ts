import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import {
  BodyTypeEmailPassword,
  handleDeanonymizeUserEmailPassword,
} from '@/utils/user/deanonymize-email-password';
import {
  BodyTypePasswordlessEmail,
  handleDeanonymizeUserPasswordlessEmail,
} from '@/utils/user/deanonymize-passwordless-email';

// export type BodyTypePasswordlessSms = {
//   signInMethod: 'passwordless';
//   connection: 'sms';
//   mode: PasswordlessMode;
//   phoneNumber: string;
//   password: string;
//   allowedRoles: string[];
//   defaultRole: string;
// };

type BodyType = BodyTypeEmailPassword | BodyTypePasswordlessEmail;
// | BodyTypePasswordlessSms;

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userDeanonymizeHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  // check if user is logged in
  if (!req.auth?.userId) {
    return res.boom.unauthorized('User not logged in');
  }

  const { body } = req;
  const { userId } = req.auth;

  if (body.signInMethod === 'email-password') {
    await handleDeanonymizeUserEmailPassword(body, userId, res);
    return;
  }

  if (body.signInMethod === 'passwordless' && body.connection === 'email') {
    await handleDeanonymizeUserPasswordlessEmail(body, userId, res);
    return res.send('ok');
  }

  // if (body.signInMethod === 'passwordless' && body.connection === 'sms') {
  //   handleDeanonymizeUserPasswordlessSms(body, res);
  // }

  return res.boom.badRequest('incorrect sign in method');
};
