import { sendError } from '@/errors';
import {
  ENV,
  getUser,
  getUserByEmail,
  performWebAuthn,
  verifyWebAuthn,
} from '@/utils';
import { RequestHandler } from 'express';

import { SignInResponse } from '@/types';
import { Joi, email } from '@/validation';

import {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';

export type ElevateWebAuthnRequestBody = { email: string };
export type ElevateWebAuthnResponseBody = PublicKeyCredentialRequestOptionsJSON;

export const elevateWebauthnSchema = Joi.object<ElevateWebAuthnRequestBody>({
  email: email.required(),
}).meta({ className: 'ElevateWebauthnSchema' });

export const elevateWebauthnHandler: RequestHandler<
  {},
  ElevateWebAuthnResponseBody,
  ElevateWebAuthnRequestBody
> = async (req, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const { userId } = req.auth as RequestAuth;

  const userRequestAuth = await getUser({ userId });

  if (!userRequestAuth) {
    return sendError(res, 'user-not-found');
  }

  const { email } = req.body;

  const user = await getUserByEmail(email);

  // ? Do we know to let anyone know if the user doesn't exist?
  if (!user) {
    return sendError(res, 'user-not-found');
  }

  if (user.id !== userRequestAuth.id) {
    return sendError(res, 'bad-request');
  }

  if (user.disabled) {
    return sendError(res, 'disabled-user');
  }

  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
    return sendError(res, 'unverified-user');
  }

  const options = await performWebAuthn(user.id);

  return res.send(options);
};

export type ElevateVerifyWebAuthnRequestBody = {
  credential: AuthenticationResponseJSON;
  email: string;
};

export type ElevateVerifyWebAuthnResponseBody = SignInResponse;

export const elevateVerifyWebauthnSchema =
  Joi.object<ElevateVerifyWebAuthnRequestBody>({
    email: email.required(),
    credential: Joi.object().required(),
  }).meta({ className: 'ElevateVerifyWebauthnSchema' });

export const elevateVerifyWebauthnHandler: RequestHandler<
  {},
  ElevateVerifyWebAuthnResponseBody,
  ElevateVerifyWebAuthnRequestBody
> = async (req, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const { userId } = req.auth as RequestAuth;

  const userRequestAuth = await getUser({ userId });

  if (!userRequestAuth) {
    return sendError(res, 'user-not-found');
  }

  const { credential, email } = req.body;

  const user = await getUserByEmail(email);

  if (!user) {
    return sendError(res, 'user-not-found');
  }

  if (user.id !== userRequestAuth.id) {
    return sendError(res, 'bad-request');
  }

  if (user.disabled) {
    return sendError(res, 'disabled-user');
  }

  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
    return sendError(res, 'unverified-user');
  }

  await verifyWebAuthn(
    user.id,
    credential,
    (code, payload) => sendError(res, code, payload),
    (signInResponse) => res.send(signInResponse),
    {
      [`x-hasura-auth-elevated`]: user.id,
    }
  );
};
