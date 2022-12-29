import { User } from '@/types';
import {
  VerifiedRegistrationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { RegistrationCredentialJSON } from '@simplewebauthn/typescript-types';

import { ENV } from './env';
import { pgClient } from './postgres-client';

export const getWebAuthnRelyingParty = () =>
  ENV.AUTH_CLIENT_URL && new URL(ENV.AUTH_CLIENT_URL).hostname;

export const getCurrentChallenge = async (id: string) => {
  const user = await pgClient.getUserChallenge(id);

  if (!user.webauthn_current_challenge) {
    throw Error('invalid-request');
  }
  return user.webauthn_current_challenge;
};

export const verifyWebAuthnRegistration = async (
  { id }: Pick<User, 'id'>,
  credential: RegistrationCredentialJSON,
  nickname?: string
) => {
  const expectedChallenge = await getCurrentChallenge(id);
  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      credential,
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

  const securityKeyId = await pgClient.addUserSecurityKey({
    user_id: id,
    credential_id: credentialId.toString('base64url'),
    credential_public_key: Buffer.from(
      '\\x' + credentialPublicKey.toString('hex')
    ).toString(),
    counter,
    nickname,
  });

  if (!securityKeyId) {
    throw Error(
      'Something went wrong. Impossible to insert new security key in the database.'
    );
  }

  await pgClient.updateUser({
    id,
    user: {
      webauthnCurrentChallenge: null,
    },
  });

  return securityKeyId;
};
