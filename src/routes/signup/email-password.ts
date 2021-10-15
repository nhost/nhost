import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import { v4 as uuidv4 } from 'uuid';

import { getGravatarUrl, getUserByEmail, hashPassword } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { emailClient } from '@/email';
import { isValidEmail } from '@/utils/email';
import { isPasswordValid } from '@/utils/password';
import { isRolesValid } from '@/utils/roles';
import { ENV } from '@/utils/env';
import { generateTicketExpiresAt } from '@/utils/ticket';
import { getSignInResponse } from '@/utils/tokens';

type BodyType = {
  email: string;
  password: string;
  options?: {
    locale?: string;
    allowedRoles?: string[];
    defaultRole?: string;
    displayName?: string;
  };
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const signUpEmailPasswordHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  const { body } = req;
  const { email, password, options } = body;

  const locale = options?.locale ?? ENV.AUTH_DEFAULT_LOCALE;

  req.log.debug({ body });

  // check email
  if (!(await isValidEmail({ email, res }))) {
    // function send potential error via `res`
    return;
  }

  // check password
  if (!(await isPasswordValid({ password, res }))) {
    // function send potential error via `res`
    return;
  }

  // check roles
  const defaultRole = options?.defaultRole ?? ENV.AUTH_DEFAULT_USER_ROLE;
  const allowedRoles =
    options?.allowedRoles ?? ENV.AUTH_DEFAULT_ALLOWED_USER_ROLES;
  if (!(await isRolesValid({ defaultRole, allowedRoles, res }))) {
    return;
  }

  req.log.debug({ defaultRole });
  req.log.debug({ allowedRoles });

  // check if email already in use by some other user
  if (await getUserByEmail(email)) {
    return res.boom.conflict('Email already in use');
  }

  // hash password
  const passwordHash = await hashPassword(password);

  // create ticket
  const ticket = `verifyEmail:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

  // restructure user roles to be inserted in GraphQL mutation
  const userRoles = allowedRoles.map((role: string) => ({ role }));

  const displayName = options?.displayName ?? email;
  const avatarUrl = getGravatarUrl(email);

  req.log.debug({ displayName, avatarUrl });

  // insert user
  const user = await gqlSdk
    .insertUser({
      user: {
        disabled: ENV.AUTH_DISABLE_NEW_USERS,
        displayName,
        avatarUrl,
        email,
        passwordHash,
        ticket,
        ticketExpiresAt,
        emailVerified: false,
        locale,
        defaultRole,
        roles: {
          data: userRoles,
        },
      },
    })
    .then((res) => res.insertUser);

  if (!user) {
    throw new Error('Unable to insert new user');
  }

  // user is now inserted. Continue sending out activation email
  if (!ENV.AUTH_DISABLE_NEW_USERS && ENV.AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED) {
    if (!ENV.AUTH_EMAILS_ENABLED) {
      throw new Error('SMTP settings unavailable');
    }

    const template = 'email-verify';
    await emailClient.send({
      template,
      message: {
        to: email,
        headers: {
          'x-ticket': {
            prepared: true,
            value: ticket,
          },
          'x-email-template': {
            prepared: true,
            value: template,
          },
        },
      },
      locals: {
        displayName,
        ticket,
        email,
        locale: user.locale,
        serverUrl: ENV.AUTH_SERVER_URL,
        clientUrl: ENV.AUTH_CLIENT_URL,
      },
    });
  }

  // SIGNIN_EMAIL_VERIFIED_REQUIRED = true => Must verify email before sign in
  // SIGNIN_EMAIL_VERIFIED_REQUIRED = true => Don't have to verify email before
  // sign in

  if (!ENV.AUTH_SIGNIN_EMAIL_VERIFIED_REQUIRED) {
    const signInResponse = await getSignInResponse({
      userId: user.id,
      checkMFA: false,
    });

    // return logged in session because user does not have to verify their email
    // to sign in
    return res.send(signInResponse);
  }

  return res.send({ session: null, mfa: null });
};
