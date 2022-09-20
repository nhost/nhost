import { sendError } from '@/errors';
import {
  ENV,
  getUserByEmail,
  generateWebAuthnRegistrationOptions,
} from '@/utils';
import { RequestHandler } from 'express';

import { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/typescript-types';
import { email, Joi, registrationOptions } from '@/validation';
import { createUserAndSendVerificationEmail } from '@/utils/user/email-verification';
import { UserRegistrationOptionsWithRedirect } from '@/types';

export type SignUpWebAuthnRequestBody = {
  email: string;
  options: UserRegistrationOptionsWithRedirect;
};
export type SignUpWebAuthnResponseBody = PublicKeyCredentialRequestOptionsJSON;

export const signUpWebauthnSchema = Joi.object<SignUpWebAuthnRequestBody>({
  email: email.required(),
  options: registrationOptions,
}).meta({ className: 'SignUpWebauthnSchema' });

export const signUpWebauthnHandler: RequestHandler<
  {},
  SignUpWebAuthnResponseBody,
  SignUpWebAuthnRequestBody
> = async ({ body: { email, options } }, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  // check if email already in use by some other user
  if (await getUserByEmail(email)) {
    return sendError(res, 'email-already-in-use');
  }

  const user = await createUserAndSendVerificationEmail(email, options);

  const registrationOptions = await generateWebAuthnRegistrationOptions(user);

  return res.send(registrationOptions);
};
