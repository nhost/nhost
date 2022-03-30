import { RequestHandler } from 'express';
import { ReasonPhrases } from 'http-status-codes';

import {
  BodyTypeEmailPassword,
  handleDeanonymizeUserEmailPassword,
  BodyTypePasswordlessEmail,
  handleDeanonymizeUserPasswordlessEmail,
} from '@/utils';
import { sendError } from '@/errors';
import { Joi, email, password, registrationOptions } from '@/validation';

// TODO should work with any other authentication methods e.g. Oauth
export const userDeanonymizeSchema = Joi.object({
  signInMethod: Joi.string()
    .valid('email-password', 'passwordless')
    .required()
    .example('email-password'),
  email: email.required(),
  password,
  connection: Joi.string().allow('email', 'sms').example('email'),
  options: registrationOptions,
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
    return res.send(ReasonPhrases.OK);
  }

  // if (body.signInMethod === 'passwordless' && body.connection === 'sms') {
  //   handleDeanonymizeUserPasswordlessSms(body, res);
  // }
  return sendError(res, 'invalid-sign-in-method');
};
