import { RequestHandler } from 'express';

import { generateRegistrationOptions } from '@simplewebauthn/server';
import {
  RegistrationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/types';

import { Joi } from '@/validation';
import { sendError, sendUnspecifiedError } from '@/errors';
import {
  ENV,
  getUser,
  verifyWebAuthnRegistration,
  getWebAuthnRelyingParty,
  gqlSdk,
} from '@/utils';

export type AddSecurityKeyRequestBody = {
  credential: string;
};

export type AddSecurityKeyResponseBody = PublicKeyCredentialCreationOptionsJSON;

export const addSecurityKeyHandler: RequestHandler<
  {},
  AddSecurityKeyResponseBody,
  AddSecurityKeyRequestBody
> = async (req, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const { userId } = req.auth as RequestAuth;

  const { displayName, email, emailVerified } = await getUser({ userId });

  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !emailVerified) {
    return sendError(res, 'unverified-user');
  }

  const { authUserSecurityKeys } = await gqlSdk.getUserSecurityKeys({
    id: userId,
  });

  const options = generateRegistrationOptions({
    rpID: getWebAuthnRelyingParty(),
    rpName: ENV.AUTH_WEBAUTHN_RP_NAME,
    userID: userId,
    userName: displayName ?? email,
    attestationType: 'indirect',
    excludeCredentials: authUserSecurityKeys.map((securityKey) => ({
      id: Buffer.from(securityKey.credentialId, 'base64url'),
      type: 'public-key',
    })),
  });

  await gqlSdk.updateUserChallenge({
    userId,
    challenge: options.challenge,
  });

  return res.send(options);
};

export type VerifySecurityKeyRequestBody = {
  credential: RegistrationResponseJSON;
  nickname?: string;
};

export type VerifySecurityKeyResponseBody = { id: string; nickname?: string };
export const userVerifyAddSecurityKeySchema =
  Joi.object<VerifySecurityKeyRequestBody>({
    credential: Joi.object().required(),
    nickname: Joi.string().optional().empty(''),
  }).meta({ className: 'VerifyAddSecurityKeySchema' });

export const addSecurityKeyVerifyHandler: RequestHandler<
  {},
  VerifySecurityKeyResponseBody,
  VerifySecurityKeyRequestBody
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
