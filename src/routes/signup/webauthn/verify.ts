import { ERRORS, sendError } from '@/errors';
import {
  ENV,
  getUserByEmail,
  getSignInResponse,
  verifyWebAuthnRegistration,
} from '@/utils';
import { RequestHandler } from 'express';

import { RegistrationCredentialJSON } from '@simplewebauthn/typescript-types';
import { email, Joi } from '@/validation';
import { SignInResponse } from '@/types';

export type SignUpVerifyWebAuthnRequestBody = {
  credential: RegistrationCredentialJSON;
  email: string;
  nickname?: string;
};

export type SignUpVerifyWebAuthnResponseBody = SignInResponse;

export const signUpVerifyWebauthnSchema =
  Joi.object<SignUpVerifyWebAuthnRequestBody>({
    email: email.required(),
    credential: Joi.object().required(),
    nickname: Joi.string().optional().empty(''),
  }).meta({ className: 'SignUpVerifyWebauthnSchema' });

export const signInVerifyWebauthnHandler: RequestHandler<
  {},
  SignUpVerifyWebAuthnResponseBody,
  SignUpVerifyWebAuthnRequestBody
> = async ({ body: { credential, email, nickname } }, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const user = await getUserByEmail(email);

  if (!user) {
    return sendError(res, 'user-not-found');
  }

  if (user.disabled) {
    return sendError(res, 'disabled-user');
  }

  try {
    await verifyWebAuthnRegistration(user, credential, nickname);
    if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
      return res.send({ session: null, mfa: null });
    }
    const signInResponse = await getSignInResponse({
      userId: user.id,
      checkMFA: false,
    });
    return res.send(signInResponse);
  } catch (e) {
    const error = e as Error;
    return sendError(res, error.message as keyof typeof ERRORS);
  }
};
