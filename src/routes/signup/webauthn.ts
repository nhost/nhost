import { sendError } from '@/errors';
import { UserRegistrationOptions } from '@/types';
import { ENV, getSignInResponse, getUserByEmail, gqlSdk } from '@/utils';
import { RequestHandler } from 'express';

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { email, Joi, passwordInsert, registrationOptions } from '@/validation';
import { createUserAndSendVerificationEmail } from '@/utils/user/email-verification';

export const signUpWebauthnSchema = Joi.object({
  email: email.required(),
  password: passwordInsert.optional(),
  options: registrationOptions,
}).meta({ className: 'SignUpWebauthnSchema' });

export const signUpVerifyWebauthnSchema = Joi.object({
  email: email.required(),
  credential: Joi.object().required(),
}).meta({ className: 'SignUpVerifyWebauthnSchema' });

// Human-readable title for your website
const rpName = 'SimpleWebAuthn Example';
// A unique identifier for your website
const rpID = 'localhost';
// The URL at which registrations and authentications should occur
const origin = `http://${rpID}:8000`;

export const signUpWebauthnHandler: RequestHandler<
  {},
  {},
  {
    email: string;
    password?: string;
    options: UserRegistrationOptions & {
      redirectTo: string;
    };
  }
> = async (req, res) => {
  const { body } = req;
  const { email, password, options } = body;

  const user = await createUserAndSendVerificationEmail(
    email,
    options,
    password
  );

  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
    return res.send({ session: null, mfa: null });
  }

  const userAuthenticators = await gqlSdk
    .getUserAuthenticators({
      id: user.id,
    })
    .then((gqlres) => gqlres.authUserAuthenticators);

  const registrationOptions = generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,
    userName: user.displayName ?? user.email,
    attestationType: 'indirect',
    excludeCredentials: userAuthenticators.map((authenticator) => ({
      id: Buffer.from(authenticator.credentialId, 'base64url'),
      type: 'public-key',
    })),
    authenticatorSelection: {
      userVerification: 'required',
    },
    /**
     * Support the two most common algorithms: ES256, and RS256
     */
    supportedAlgorithmIDs: [-7, -257],
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
    credential: any;
    email: string;
  }
> = async (req, res) => {
  const { credential, email } = req.body;

  const user = await getUserByEmail(email);

  if (!user) {
    return sendError(res, 'user-not-found');
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
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (error) {
    return sendError(res, 'unauthenticated-user');
  }

  const { verified } = verification;

  if (verified) {
    const { registrationInfo } = verification;

    if (!registrationInfo) {
      throw Error('ops...');
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

    const signInResponse = await getSignInResponse({
      userId: user.id,
      checkMFA: false,
    });

    return res.send(signInResponse);
  }
};
