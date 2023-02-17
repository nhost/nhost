import { sendError } from '@/errors';
import {
  ENV,
  getSignInResponse,
  getUserByEmail,
  gqlSdk,
  getWebAuthnRelyingParty,
  getCurrentChallenge,
} from '@/utils';
import { RequestHandler } from 'express';

import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import {
  AuthenticationCredentialJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/typescript-types';
import { email, Joi } from '@/validation';
import { SignInResponse } from '@/types';

export type SignInWebAuthnRequestBody = { email: string };
export type SignInWebAuthnResponseBody = PublicKeyCredentialRequestOptionsJSON;

export const signInWebauthnSchema = Joi.object<SignInWebAuthnRequestBody>({
  email: email.required(),
}).meta({ className: 'SignInWebauthnSchema' });

export const signInWebauthnHandler: RequestHandler<
  {},
  SignInWebAuthnResponseBody,
  SignInWebAuthnRequestBody
> = async (req, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const { body } = req;
  const { email } = body;

  const user = await getUserByEmail(email);

  // ? Do we know to let anyone know if the user doesn't exist?
  if (!user) {
    return sendError(res, 'user-not-found');
  }

  if (user.disabled) {
    return sendError(res, 'disabled-user');
  }

  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
    return sendError(res, 'unverified-user');
  }

  const { authUserSecurityKeys } = await gqlSdk.getUserSecurityKeys({
    id: user.id,
  });

  const options = generateAuthenticationOptions({
    rpID: getWebAuthnRelyingParty(),
    userVerification: 'preferred',
    timeout: ENV.AUTH_WEBAUTHN_ATTESTATION_TIMEOUT,
    allowCredentials: authUserSecurityKeys.map((securityKey) => ({
      id: Buffer.from(securityKey.credentialId, 'base64url'),
      type: 'public-key',
    })),
  });

  await gqlSdk.updateUserChallenge({
    userId: user.id,
    challenge: options.challenge,
  });

  return res.send(options);
};

export type SignInVerifyWebAuthnRequestBody = {
  credential: AuthenticationCredentialJSON;
  email: string;
};

export type SignInVerifyWebAuthnResponseBody = SignInResponse;

export const signInVerifyWebauthnSchema =
  Joi.object<SignInVerifyWebAuthnRequestBody>({
    email: email.required(),
    credential: Joi.object().required(),
  }).meta({ className: 'SignInVerifyWebauthnSchema' });

export const signInVerifyWebauthnHandler: RequestHandler<
  {},
  SignInVerifyWebAuthnResponseBody,
  SignInVerifyWebAuthnRequestBody
> = async (req, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const { credential, email } = req.body;

  const user = await getUserByEmail(email);

  if (!user) {
    return sendError(res, 'user-not-found');
  }

  if (user.disabled) {
    return sendError(res, 'disabled-user');
  }

  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
    return sendError(res, 'unverified-user');
  }

  const expectedChallenge = await getCurrentChallenge(user.id);

  const { authUserSecurityKeys } = await gqlSdk.getUserSecurityKeys({
    id: user.id,
  });
  const securityKey = authUserSecurityKeys?.find(
    ({ credentialId }) => credentialId === credential.id
  );

  if (!securityKey) {
    return sendError(res, 'invalid-request');
  }

  const securityKeyDevice = {
    counter: securityKey.counter,
    credentialID: Buffer.from(securityKey.credentialId, 'base64url'),
    credentialPublicKey: Buffer.from(
      securityKey.credentialPublicKey.substr(2),
      'hex'
    ),
  };

  let verification;
  try {
    verification = verifyAuthenticationResponse({
      credential,
      expectedChallenge,
      expectedOrigin: ENV.AUTH_WEBAUTHN_RP_ORIGINS,
      expectedRPID: getWebAuthnRelyingParty(),
      authenticator: securityKeyDevice,
      requireUserVerification: true,
    });
  } catch (e) {
    const error = e as Error;
    return sendError(res, 'invalid-webauthn-security-key', {
      customMessage: error.message,
    });
  }

  const { verified } = verification;

  if (!verified) {
    return sendError(res, 'invalid-webauthn-verification');
  }

  const { authenticationInfo } = verification;
  const { newCounter } = authenticationInfo;

  if (securityKey.counter != newCounter) {
    await gqlSdk.updateUserSecurityKey({
      id: securityKey.id,
      counter: newCounter,
    });
  }

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInResponse);
};
