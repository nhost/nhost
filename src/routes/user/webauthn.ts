import { RequestHandler } from 'express';
import {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationCredentialJSON,
} from '@simplewebauthn/typescript-types';
import { generateRegistrationOptions } from '@simplewebauthn/server';

import { Joi } from '@/validation';
import { sendError, sendUnspecifiedError } from '@/errors';
import {
  ENV,
  getUser,
  verifyWebAuthnRegistration,
  getWebAuthnRelyingParty,
  gqlSdk,
} from '@/utils';

export type AddAuthenticatorRequestBody = {
  credential: string;
};

export type AddAuthenticatorResponseBody =
  PublicKeyCredentialCreationOptionsJSON;

export const addAuthenticatorHandler: RequestHandler<
  {},
  AddAuthenticatorResponseBody,
  AddAuthenticatorRequestBody
> = async (req, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const { userId } = req.auth as RequestAuth;

  const { displayName, email, emailVerified } = await getUser({ userId });

  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !emailVerified) {
    return sendError(res, 'unverified-user');
  }

  const { authUserAuthenticators } = await gqlSdk.getUserAuthenticators({
    id: userId,
  });

  const options = generateRegistrationOptions({
    rpID: getWebAuthnRelyingParty(),
    rpName: ENV.AUTH_WEBAUTHN_RP_NAME,
    userID: userId,
    userName: displayName ?? email,
    attestationType: 'indirect',
    excludeCredentials: authUserAuthenticators.map((authenticator) => ({
      id: Buffer.from(authenticator.credentialId, 'base64url'),
      type: 'public-key',
    })),
  });

  await gqlSdk.updateUserChallenge({
    userId,
    challenge: options.challenge,
  });

  return res.send(options);
};

export type VerifyAuthenticatorRequestBody = {
  credential: RegistrationCredentialJSON;
  nickname?: string;
};

export type VerifyAuthenticatorResponseBody = { id: string; nickname?: string };
export const userVerifyAddAuthenticatorSchema =
  Joi.object<VerifyAuthenticatorRequestBody>({
    credential: Joi.object().required(),
    nickname: Joi.string().optional().empty(''),
  }).meta({ className: 'VerifyAddAuthenticatorSchema' });

export const addAuthenticatorVerifyHandler: RequestHandler<
  {},
  VerifyAuthenticatorResponseBody,
  VerifyAuthenticatorRequestBody
> = async ({ body: { credential, nickname }, auth }, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const userId = auth?.userId;
  if (!userId) {
    return sendError(res, 'unauthenticated-user');
  }

  const user = await getUser({ userId });

  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
    return sendError(res, 'unverified-user');
  }

  try {
    const id = await verifyWebAuthnRegistration(user, credential, nickname);

    return res.send({ nickname, id });
  } catch (e) {
    return sendUnspecifiedError(res, e);
  }
};
