import { User } from '@/types';
import {
  VerifiedRegistrationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { RegistrationCredentialJSON } from '@simplewebauthn/typescript-types';

import { ENV } from './env';
import { gqlSdk } from './gql-sdk';
import { AuthUserAuthenticators_Insert_Input } from './__generated__/graphql-request';

export const getWebAuthnRelyingParty = () =>
  ENV.AUTH_SERVER_URL && new URL(ENV.AUTH_SERVER_URL).hostname;

export const verifyWebAuthnRegistration = async (
  { id, currentChallenge }: Pick<User, 'id' | 'currentChallenge'>,
  credential: RegistrationCredentialJSON,
  nickname?: string
) => {
  if (!currentChallenge) {
    throw Error('invalid-request');
  }

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      credential,
      expectedChallenge: currentChallenge,
      expectedOrigin: ENV.AUTH_WEBAUTHN_RP_ORIGINS,
      expectedRPID: getWebAuthnRelyingParty(),
    });
  } catch (e) {
    throw Error('invalid-webauthn-authenticator');
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
      userId: id,
      ...newAuthenticator,
    },
  });

  if (!insertAuthUserAuthenticator?.id) {
    throw Error(
      'Something went wrong. Impossible to insert new authenticator in the database.'
    );
  }

  await gqlSdk.updateUser({
    id,
    user: {
      currentChallenge: null,
    },
  });

  return insertAuthUserAuthenticator.id;
};
