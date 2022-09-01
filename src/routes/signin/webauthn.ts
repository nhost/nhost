import { sendError } from '@/errors';
import { ENV, getSignInResponse, getUserByEmail, gqlSdk } from '@/utils';
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

  const { authUserAuthenticators } = await gqlSdk.getUserAuthenticators({
    id: user.id,
  });

  const options = generateAuthenticationOptions({
    rpID: ENV.AUTH_WEBAUTHN_RP_ID,
    userVerification: 'preferred',
    timeout: ENV.AUTH_WEBAUTHN_ATTESTATION_TIMEOUT,
    allowCredentials: authUserAuthenticators.map((authenticator) => ({
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

  const expectedChallenge = await gqlSdk
    .getUserChallenge({
      id: user.id,
    })
    .then((gqlres) => gqlres.user?.currentChallenge);

  if (!expectedChallenge) {
    return sendError(res, 'invalid-request');
  }

  const authenticator = await gqlSdk
    .getUserAuthenticators({
      id: user.id,
    })
    .then(({ authUserAuthenticators }) =>
      authUserAuthenticators.find(
        ({ credentialId }) => credentialId === credential.id
      )
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
      expectedOrigin: ENV.AUTH_WEBAUTHN_RP_ORIGINS,
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
