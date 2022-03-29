import { RequestHandler } from 'express';

import {
  BodyTypeEmailPassword,
  handleDeanonymizeUserEmailPassword,
} from '@/utils/user/deanonymize-email-password';
import {
  BodyTypePasswordlessEmail,
  handleDeanonymizeUserPasswordlessEmail,
} from '@/utils/user/deanonymize-passwordless-email';

export const userDeanonymizeHandler: RequestHandler<
  {},
  {},
  BodyTypeEmailPassword | BodyTypePasswordlessEmail
> = async (req, res) => {
  const { body } = req;
  const { userId } = req.auth as RequestAuth;

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
