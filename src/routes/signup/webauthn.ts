import { sendError } from '@/errors';
import { UserRegistrationOptions } from '@/types';
import { ENV, getSignInResponse, getUserByEmail, gqlSdk } from '@/utils';
import { RequestHandler } from 'express';

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { RegistrationCredentialJSON } from '@simplewebauthn/typescript-types';
import { email, Joi, registrationOptions } from '@/validation';
import { createUserAndSendVerificationEmail } from '@/utils/user/email-verification';

export const signUpWebauthnSchema = Joi.object({
  email: email.required(),
  options: registrationOptions,
}).meta({ className: 'SignUpWebauthnSchema' });

export const signUpVerifyWebauthnSchema = Joi.object({
  email: email.required(),
  credential: Joi.object().required(),
}).meta({ className: 'SignUpVerifyWebauthnSchema' });

export const signUpWebauthnHandler: RequestHandler<
  {},
  {},
  {
    email: string;
    options: UserRegistrationOptions & {
      redirectTo: string;
    };
  }
> = async (req, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const { body } = req;
  const { email, options } = body;

  // check if email already in use by some other user
  if (await getUserByEmail(email)) {
    return sendError(res, 'email-already-in-use');
  }

  const user = await createUserAndSendVerificationEmail(email, options);

  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
    return res.send({ session: null, mfa: null });
  }

  const userAuthenticators = await gqlSdk
    .getUserAuthenticators({
      id: user.id,
    })
    .then((gqlres) => gqlres.authUserAuthenticators);

  if (userAuthenticators.length) {
    return sendError(res, 'invalid-sign-in-method');
  }

  const registrationOptions = generateRegistrationOptions({
    rpID: ENV.AUTH_WEBAUTHN_RP_ID,
    rpName: ENV.AUTH_WEBAUTHN_RP_NAME,
    userID: user.id,
    userName: user.displayName ?? user.email,
    attestationType: 'indirect',
    /**
     * Support the two most common algorithms: ES256, and RS256
     */
    supportedAlgorithmIDs: [-7, -257],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'required',
      requireResidentKey: true,
    },
    excludeCredentials: userAuthenticators.map((authenticator) => ({
      id: Buffer.from(authenticator.credentialId, 'base64url'),
      type: 'public-key',
    })),
  });

  await gqlSdk.updateUserChallenge({
    userId: user.id,
    challenge: registrationOptions.challenge,
  });

  return res.send(registrationOptions);
};

export const signUpVerifyWebauthnHandler: RequestHandler<
  {},
  {},
  {
    credential: RegistrationCredentialJSON;
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

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      credential: credential,
      expectedChallenge,
      expectedOrigin: Array.from([
        ENV.AUTH_CLIENT_URL,
        ...ENV.AUTH_WEBAUTHN_RP_ORIGINS,
      ]).filter(Boolean),
      expectedRPID: ENV.AUTH_WEBAUTHN_RP_ID,
    });
  } catch (error) {
    return sendError(res, 'invalid-request');
  }

  const { verified } = verification;

  if (!verified) {
    return sendError(res, 'unverified-user');
  }

  const { registrationInfo } = verification;

  if (!registrationInfo) {
    throw Error('Something went wrong. Incomplete Webauthn verification.');
  }

  const {
    credentialPublicKey,
    credentialID: credentialId,
    counter,
  } = registrationInfo;

  const newAuthenticator = {
    credentialId: credentialId.toString('base64url'),
    credentialPublicKey: Buffer.from(
      '\\x' + credentialPublicKey.toString('hex')
    ).toString(),
    counter,
  };

  await gqlSdk.addUserAuthenticator({
    userAuthenticator: {
      userId: user.id,
      ...newAuthenticator,
    },
  });

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      currentChallenge: null,
    },
  });

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInResponse);
};
