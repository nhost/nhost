import { RequestHandler } from 'express';

import {
  BodyTypeEmailPassword,
  handleDeanonymizeUserEmailPassword,
} from '@/utils/user/deanonymize-email-password';
import {
  BodyTypePasswordlessEmail,
  handleDeanonymizeUserPasswordlessEmail,
} from '@/utils/user/deanonymize-passwordless-email';
import { sendError } from '@/errors';
import {
  Joi,
  email,
  password,
  redirectTo,
  registrationOptions,
} from '@/validation';

// TODO should work with any other authentication methods e.g. Oauth
export const userDeanonymizeSchema = Joi.object({
  signInMethod: Joi.string()
    .allow('email-password')
    .allow('passwordless')
    .required()
    .example('email-password'),
  email: email.required(),
  password,
  connection: Joi.string().allow('email', 'sms').example('email'),
  options: registrationOptions.keys({
    redirectTo,
  }),
})
  .meta({ className: 'UserDeanonymizeSchema' })
  .default();

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
  return sendError(res, 'invalid-sign-in-method');
};
