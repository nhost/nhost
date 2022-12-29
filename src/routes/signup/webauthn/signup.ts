import { sendError } from '@/errors';
import {
  ENV,
  getUserByEmail,
  getGravatarUrl,
  insertUser,
  getWebAuthnRelyingParty,
} from '@/utils';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { v4 as uuidv4 } from 'uuid';
import { RequestHandler } from 'express';

import { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/typescript-types';
import { email, Joi, registrationOptions } from '@/validation';
import { UserRegistrationOptions } from '@/types';

export type SignUpWebAuthnRequestBody = {
  email: string;
  options: UserRegistrationOptions;
};
export type SignUpWebAuthnResponseBody = PublicKeyCredentialRequestOptionsJSON;

export const signUpWebauthnSchema = Joi.object<SignUpWebAuthnRequestBody>({
  email: email.required(),
  options: registrationOptions.unknown(true),
}).meta({ className: 'SignUpWebauthnSchema' });

export const signUpWebauthnHandler: RequestHandler<
  {},
  SignUpWebAuthnResponseBody,
  SignUpWebAuthnRequestBody
> = async ({ body: { email, options } }, res) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  // check if email already in use by some other user
  if (await getUserByEmail(email)) {
    return sendError(res, 'email-already-in-use');
  }

  const {
    locale,
    defaultRole,
    allowedRoles,
    metadata,
    displayName = email,
  } = options;

  const userId = uuidv4();
  const registrationOptions = generateRegistrationOptions({
    rpID: getWebAuthnRelyingParty(),
    rpName: ENV.AUTH_WEBAUTHN_RP_NAME,
    userID: userId,
    userName: displayName ?? email,
    attestationType: 'indirect',
  });

  await insertUser({
    id: userId,
    isAnonymous: true,
    newEmail: email,
    disabled: ENV.AUTH_DISABLE_NEW_USERS,
    displayName,
    avatarUrl: getGravatarUrl(email),
    emailVerified: false,
    locale,
    defaultRole,
    roles: allowedRoles,
    metadata,
    webauthnCurrentChallenge: registrationOptions.challenge,
  });
  return res.send(registrationOptions);
};
