import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import { v4 as uuidv4 } from 'uuid';

import {
  getGravatarUrl,
  getUserByEmail,
  hashPassword,
  isValidRedirectTo,
} from '@/helpers';
import { emailClient } from '@/email';
import { isValidEmail } from '@/utils/email';
import { isPasswordValid } from '@/utils/password';
import { isRolesValid } from '@/utils/roles';
import { ENV } from '@/utils/env';
import { generateTicketExpiresAt } from '@/utils/ticket';
import { getSignInResponse } from '@/utils/tokens';
import { insertUser } from '@/utils/user';
import { UserRegistrationOptions } from '@/types';

type BodyType = {
  email: string;
  password: string;
  options?: UserRegistrationOptions & {
    redirectTo?: string;
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

  // check if redirectTo is valid
  const redirectTo = options?.redirectTo ?? ENV.AUTH_CLIENT_URL;
  if (!isValidRedirectTo({ redirectTo })) {
    return res.boom.badRequest(`'redirectTo' is not valid`);
  }

  const locale = options?.locale ?? ENV.AUTH_LOCALE_DEFAULT;
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
  const defaultRole = options?.defaultRole ?? ENV.AUTH_USER_DEFAULT_ROLE;
  const allowedRoles =
    options?.allowedRoles ?? ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES;
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
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60 * 24 * 30); // 30 days

  // restructure user roles to be inserted in GraphQL mutation
  const userRoles = allowedRoles.map((role: string) => ({ role }));

  const displayName = options?.displayName ?? email;
  const avatarUrl = getGravatarUrl(email);

  req.log.debug({ displayName, avatarUrl });

  // insert user
  const user = await insertUser({
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
    metadata: options?.metadata || {},
  });

  // user is now inserted. Continue sending out activation email
  if (
    !ENV.AUTH_DISABLE_NEW_USERS &&
    ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED
  ) {
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
          'x-redirect-to': {
            prepared: true,
            value: redirectTo,
          },
          'x-email-template': {
            prepared: true,
            value: template,
          },
        },
      },
      locals: {
        link: `${ENV.AUTH_SERVER_URL}/verify?&ticket=${ticket}&type=emailVerify&redirectTo=${redirectTo}`,
        displayName,
        email,
        ticket,
        redirectTo,
        locale: user.locale,
        serverUrl: ENV.AUTH_SERVER_URL,
        clientUrl: ENV.AUTH_CLIENT_URL,
      },
    });
  }

  // SIGNIN_EMAIL_VERIFIED_REQUIRED = true => Must verify email before sign in
  // SIGNIN_EMAIL_VERIFIED_REQUIRED = true => Don't have to verify email before
  // sign in

  if (!ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED) {
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
