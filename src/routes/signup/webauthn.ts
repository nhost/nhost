import { sendError } from '@/errors';
import { v4 as uuidv4 } from 'uuid';
import { UserRegistrationOptions } from '@/types';
import {
  ENV,
  generateTicketExpiresAt,
  getGravatarUrl,
  getSignInResponse,
  getUserByEmail,
  gqlSdk,
  insertUser,
} from '@/utils';
import { RequestHandler } from 'express';

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { Joi, uuid } from '@/validation';

export const signUpVerifyWebauthnSchema = Joi.object({
  user: {
    id: uuid.required(),
    name: Joi.string().required(),
    displayName: Joi.string().required(),
  },
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
    password: string;
    options: UserRegistrationOptions & {
      redirectTo: string;
    };
  }
> = async (req, res) => {
  const { body } = req;
  const {
    email,
    options: {
      locale,
      defaultRole,
      allowedRoles,
      metadata,
      displayName = email,
    },
  } = body;

  // check if email already in use by some other user
  if (await getUserByEmail(email)) {
    return sendError(res, 'email-already-in-use');
  }

  // create ticket
  const ticket = `verifyEmail:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60 * 24 * 30); // 30 days

  // insert user
  const user = await insertUser({
    disabled: ENV.AUTH_DISABLE_NEW_USERS,
    displayName,
    avatarUrl: getGravatarUrl(email),
    email,
    ticket,
    ticketExpiresAt,
    emailVerified: false,
    locale,
    defaultRole,
    roles: {
      // restructure user roles to be inserted in GraphQL mutation
      data: allowedRoles.map((role: string) => ({ role })),
    },
    metadata,
  });

  const userAuthenticators = await gqlSdk
    .authUserAuthenticators({
      id: user.id,
    })
    .then((gqlres) => gqlres.authUserAuthenticators);

  const options = generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,
    userName: user.displayName ?? user.email,
    // Don't prompt users for additional information about the authenticator
    // (Recommended for smoother UX)
    attestationType: 'indirect',
    // Prevent users from re-registering existing authenticators
    excludeCredentials: userAuthenticators.map((authenticator) => ({
      id: Buffer.from(authenticator.credentialId, 'base64url'),
      type: 'public-key',
      transports:
        (authenticator.transports.split(',') as AuthenticatorTransport[]) ??
        (['usb', 'ble', 'nfc', 'internal'] as AuthenticatorTransport[]),
    })),
    /**
     * The optional authenticatorSelection property allows for specifying more constraints around
     * the types of authenticators that users to can use for registration
     */
    authenticatorSelection: {
      userVerification: 'required',
    },
    /**
     * Support the two most common algorithms: ES256, and RS256
     */
    supportedAlgorithmIDs: [-7, -257],
  });

  await gqlSdk.updateAuthUserChallenge({
    userId: user.id,
    challenge: options.challenge,
  });

  return res.send(options);
};

export const signUpVerifyWebauthnHandler: RequestHandler<
  {},
  {},
  {
    credential: any;
    user: {
      id: string;
      name: string;
      displayName: string;
    };
  }
> = async (req, res) => {
  const { credential, user } = req.body;

  const expectedChallenge = await gqlSdk
    .getUserChallenge({
      id: user.id,
    })
    .then((gqlres) => gqlres.user?.current_challenge);

  if (!expectedChallenge) {
    return sendError(res, 'user-not-found');
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
    console.error(error);
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
