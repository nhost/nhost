import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { getGravatarUrl, getUserByEmail, isValidRedirectTo } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { emailClient } from '@/email';
import { ENV } from '@/utils/env';
import { isValidEmail } from '@/utils/email';
import { isRolesValid } from '@/utils/roles';
import { PasswordLessEmailBody } from '@/types';
import { generateTicketExpiresAt } from '@/utils/ticket';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: PasswordLessEmailBody;
}

export const signInPasswordlessEmailHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  if (!ENV.AUTH_PASSWORDLESS_EMAIL_ENABLED) {
    return res.boom.notFound('Passwordless sign in with email is not enabled');
  }

  if (!ENV.AUTH_EMAILS_ENABLED) {
    return res.boom.internal('SMTP settings unavailable');
  }

  const { email, options } = req.body;

  // check if redirectTo is valid
  const redirectTo = options?.redirectTo ?? ENV.AUTH_CLIENT_URL;
  if (!isValidRedirectTo({ redirectTo })) {
    return res.boom.badRequest(`'redirectTo' is not allowed`);
  }

  // check if email already exist
  let user = await getUserByEmail(email);

  let userId = user ? user.id : undefined;

  // if no user exists, create the user
  if (!user) {
    // check email
    if (!(await isValidEmail({ email, res }))) {
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

    // set default role

    // restructure user roles to be inserted in GraphQL mutation
    const userRoles = allowedRoles.map((role: string) => ({ role }));

    const displayName = options?.displayName ?? email;
    const locale = options?.locale ?? ENV.AUTH_DEFAULT_LOCALE;
    const avatarUrl = getGravatarUrl(email);

    // create new user
    const insertedUser = await gqlSdk
      .insertUser({
        user: {
          disabled: ENV.AUTH_DISABLE_NEW_USERS,
          displayName,
          avatarUrl,
          email,
          locale,
          defaultRole,
          roles: {
            data: userRoles,
          },
        },
      })
      .then((res) => res.insertUser);

    if (!insertedUser) {
      console.log('unable to insert new user');
      throw new Error('Unable to insert new user');
    }

    user = insertedUser;
    userId = insertedUser.id;
  }

  // create ticket
  const ticket = `passwordlessEmai:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

  await gqlSdk.updateUser({
    id: userId,
    user: {
      ticket,
      ticketExpiresAt,
    },
  });

  const template = 'signin-passwordless';
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
      displayName: user.displayName,
      email,
      ticket,
      redirectTo,
      locale: user.locale,
      serverUrl: ENV.AUTH_SERVER_URL,
      clientUrl: ENV.AUTH_CLIENT_URL,
    },
  });

  return res.send('ok');
};
