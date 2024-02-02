import { ClaimValueType, SignInResponse, User } from '@/types';
import { type Response } from 'express';

import {
  VerifiedRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

import {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/types';

import { ERRORS } from '@/errors';
import { AuthUserSecurityKeys_Insert_Input } from './__generated__/graphql-request';
import { ENV } from './env';
import { gqlSdk } from './gql-sdk';
import { getSignInResponse } from './session';

export const getWebAuthnRelyingParty = () => {
  if (ENV.AUTH_WEBAUTHN_RP_ID) {
    return ENV.AUTH_WEBAUTHN_RP_ID;
  }

  return ENV.AUTH_CLIENT_URL && new URL(ENV.AUTH_CLIENT_URL).hostname;
};

export const getCurrentChallenge = async (id: string) => {
  const { user } = await gqlSdk.getUserChallenge({ id });

  if (!user?.currentChallenge) {
    throw Error('invalid-request');
  }
  return user.currentChallenge;
};

export const verifyWebAuthnRegistration = async (
  { id }: Pick<User, 'id'>,
  response: RegistrationResponseJSON,
  nickname?: string
) => {
  const expectedChallenge = await getCurrentChallenge(id);
  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ENV.AUTH_WEBAUTHN_RP_ORIGINS,
      expectedRPID: getWebAuthnRelyingParty(),
    });
  } catch (e) {
    throw Error('invalid-webauthn-security-key');
  }

  const { verified, registrationInfo } = verification;

  if (!verified) {
    throw Error('invalid-webauthn-verification');
  }

  if (!registrationInfo) {
    throw Error('invalid-webauthn-verification');
  }

  const {
    credentialPublicKey,
    credentialID: credentialId,
    counter,
  } = registrationInfo;

  const newSecurityKey: AuthUserSecurityKeys_Insert_Input = {
    credentialId: Buffer.from(credentialId).toString('base64url'),
    credentialPublicKey: Buffer.from(
      '\\x' + Buffer.from(credentialPublicKey).toString('hex')
    ).toString(),
    counter,
    nickname,
  };

  const { insertAuthUserSecurityKey } = await gqlSdk.addUserSecurityKey({
    userSecurityKey: {
      userId: id,
      ...newSecurityKey,
    },
  });

  if (!insertAuthUserSecurityKey?.id) {
    throw Error(
      'Something went wrong. Impossible to insert new security key in the database.'
    );
  }

  await gqlSdk.updateUser({
    id,
    user: {
      currentChallenge: null,
    },
  });

  return insertAuthUserSecurityKey.id;
};

export const performWebAuthn = async (userId: string) => {
  const { authUserSecurityKeys } = await gqlSdk.getUserSecurityKeys({
    id: userId,
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
    userId: userId,
    challenge: options.challenge,
  });

  return options;
};

export const verifyWebAuthn = async (
  userId: string,
  response: AuthenticationResponseJSON,
  onError: (
    code: keyof typeof ERRORS,
    payload?: { customMessage?: string; redirectTo?: string }
  ) => void | Response,
  onSuccess: (signInResponse: SignInResponse) => Response,
  extraClaims?: {
    [key: string]: ClaimValueType;
  }
) => {
  const expectedChallenge = await getCurrentChallenge(userId);

  const { authUserSecurityKeys } = await gqlSdk.getUserSecurityKeys({
    id: userId,
  });

  const securityKey = authUserSecurityKeys?.find(
    ({ credentialId }) => credentialId === response.id
  );

  if (!securityKey) {
    return onError('invalid-request');
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
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ENV.AUTH_WEBAUTHN_RP_ORIGINS,
      expectedRPID: getWebAuthnRelyingParty(),
      authenticator: securityKeyDevice,
      requireUserVerification: true,
    });
  } catch (e) {
    const error = e as Error;

    return onError('invalid-webauthn-security-key', {
      customMessage: error.message,
    });
  }

  const { verified } = verification;

  if (!verified) {
    return onError('invalid-webauthn-verification');
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
    userId: userId,
    checkMFA: false,
    extraClaims: extraClaims,
  });

  return onSuccess(signInResponse);
};
