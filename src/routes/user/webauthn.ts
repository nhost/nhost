import { RequestHandler } from 'express';
import {
  VerifiedRegistrationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationCredentialJSON,
} from '@simplewebauthn/typescript-types';

import { Joi } from '@/validation';
import { sendError } from '@/errors';
import {
  ENV,
  getUser,
  gqlSdk,
  getWebAuthnRelyingParty,
  generateWebAuthnRegistrationOptions,
} from '@/utils';
import { AuthUserAuthenticators_Insert_Input } from '@/utils/__generated__/graphql-request';

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

  const user = await getUser({ userId });

  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
    return sendError(res, 'unverified-user');
  }

  const registrationOptions = await generateWebAuthnRegistrationOptions(user);

  return res.send(registrationOptions);
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
> = async (req, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const { credential, nickname } = req.body;

  const { userId } = req.auth as RequestAuth;

  const user = await getUser({ userId });

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

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      credential: credential,
      expectedChallenge,
      expectedOrigin: ENV.AUTH_WEBAUTHN_RP_ORIGINS,
      expectedRPID: getWebAuthnRelyingParty(),
    });
  } catch (e) {
    const error = e as Error;
    return sendError(res, 'invalid-webauthn-authenticator', {
      customMessage: error.message,
    });
  }

  const { verified, registrationInfo } = verification;

  if (!verified) {
    return sendError(res, 'invalid-webauthn-verification');
  }

  if (!registrationInfo) {
    throw Error('Something went wrong. Incomplete Webauthn verification.');
  }

  const {
    credentialPublicKey,
    credentialID: credentialId,
    counter,
  } = registrationInfo;

  const newAuthenticator: AuthUserAuthenticators_Insert_Input = {
    credentialId: credentialId.toString('base64url'),
    credentialPublicKey: Buffer.from(
      '\\x' + credentialPublicKey.toString('hex')
    ).toString(),
    counter,
    nickname,
  };

  const { insertAuthUserAuthenticator } = await gqlSdk.addUserAuthenticator({
    userAuthenticator: {
      userId: user.id,
      ...newAuthenticator,
    },
  });

  if (!insertAuthUserAuthenticator?.id) {
    throw Error(
      'Something went wrong. Impossible to insert new authenticator in the database.'
    );
  }

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      currentChallenge: null,
    },
  });

  return res.send({ nickname, id: insertAuthUserAuthenticator.id });
};
