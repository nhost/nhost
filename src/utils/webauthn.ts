import { User } from '@/types';
import {
  VerifiedRegistrationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { RegistrationCredentialJSON } from '@simplewebauthn/typescript-types';

import { ENV } from './env';
import { gqlSdk } from './gql-sdk';
import { AuthUserSecurityKeys_Insert_Input } from './__generated__/graphql-request';

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

  const newSecurityKey: AuthUserSecurityKeys_Insert_Input = {
    credentialId: credentialId.toString('base64url'),
    credentialPublicKey: Buffer.from(
      '\\x' + credentialPublicKey.toString('hex')
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
