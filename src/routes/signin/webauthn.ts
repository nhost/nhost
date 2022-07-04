import { sendError } from '@/errors';
import { ENV, getSignInResponse, getUserByEmail, gqlSdk } from '@/utils';
import { RequestHandler } from 'express';

import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { AuthenticationCredentialJSON } from '@simplewebauthn/typescript-types';
import { email, Joi } from '@/validation';

export const signInWebauthnSchema = Joi.object({
  email: email.required(),
}).meta({ className: 'SignInWebauthnSchema' });

export const signInVerifyWebauthnSchema = Joi.object({
  email: email.required(),
  credential: Joi.object().required(),
}).meta({ className: 'SignInVerifyWebauthnSchema' });

export const signInWebauthnHandler: RequestHandler<
  {},
  {},
  {
    email: string;
  }
> = async (req, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const { body } = req;
  const { email } = body;

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

  const userAuthenticators = await gqlSdk
    .getUserAuthenticators({
      id: user.id,
    })
    .then((gqlres) => gqlres.authUserAuthenticators);

  const options = generateAuthenticationOptions({
    rpID: ENV.AUTH_WEBAUTHN_RP_ID,
    userVerification: 'preferred',
    timeout: ENV.AUTH_WEBAUTHN_ATTESTATION_TIMEOUT,
    allowCredentials: userAuthenticators.map((authenticator) => ({
      id: Buffer.from(authenticator.credentialId, 'base64url'),
      type: 'public-key',
    })),
  });

  await gqlSdk.updateUserChallenge({
    userId: user.id,
    challenge: options.challenge,
  });

  return res.send(options);
};

export const signInVerifyWebauthnHandler: RequestHandler<
  {},
  {},
  {
    credential: AuthenticationCredentialJSON;
    email: string;
  }
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

  const expectedChallenge = await gqlSdk
    .getUserChallenge({
      id: user.id,
    })
    .then((gqlres) => gqlres.user?.currentChallenge);

  if (!expectedChallenge) {
    return sendError(res, 'invalid-request');
  }

  const userAuthenticators = await gqlSdk
    .getUserAuthenticators({
      id: user.id,
    })
    .then((gqlres) => gqlres.authUserAuthenticators);

  const authenticator = userAuthenticators.find(
    (auth) => auth.credentialId === credential.id
  );

  if (!authenticator) {
    return sendError(res, 'invalid-request');
  }

  const authenticatorDevice = {
    counter: authenticator.counter,
    credentialID: Buffer.from(authenticator.credentialId, 'base64url'),
    credentialPublicKey: Buffer.from(
      authenticator.credentialPublicKey.substr(2),
      'hex'
    ),
  };

  let verification;
  try {
    verification = verifyAuthenticationResponse({
      credential,
      expectedChallenge,
      expectedOrigin: Array.from([
        ENV.AUTH_CLIENT_URL,
        ...ENV.AUTH_WEBAUTHN_RP_ORIGINS,
      ]).filter(Boolean),
      expectedRPID: ENV.AUTH_WEBAUTHN_RP_ID,
      authenticator: authenticatorDevice,
      requireUserVerification: true,
    });
  } catch (error) {
    return sendError(res, 'unauthenticated-user');
  }

  const { verified } = verification;

  if (!verified) {
    return sendError(res, 'unverified-user');
  }

  const { authenticationInfo } = verification;
  const { newCounter } = authenticationInfo;

  if (authenticator.counter != newCounter) {
    await gqlSdk.updateUserAuthenticator({
      id: authenticator.id,
      counter: newCounter,
    });
  }

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInResponse);
};
