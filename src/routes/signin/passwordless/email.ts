import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { getGravatarUrl, getUserByEmail, isValidRedirectTo } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { emailClient } from '@/email';
import { ENV } from '@/utils/env';
import { isValidEmail } from '@/utils/email';
import { isRolesValid } from '@/utils/roles';
import { PasswordLessEmailBody } from '@/types';
import { generateTicketExpiresAt } from '@/utils/ticket';
import { insertUser } from '@/utils/user';

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: PasswordLessEmailBody;
}

export const signInPasswordlessEmailHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  if (!ENV.AUTH_EMAIL_PASSWORDLESS_ENABLED) {
    return res.boom.notFound('Passwordless sign in with email is not enabled');
  }

  const { email, options } = req.body;

  // check if redirectTo is valid
  const redirectTo = options?.redirectTo ?? ENV.AUTH_CLIENT_URL;
  if (!isValidRedirectTo(redirectTo)) {
    return res.boom.badRequest(`'redirectTo' is not valid.`);
  }

  // check if email already exist
  let user = await getUserByEmail(email);

  // if no user exists, create the user
  if (!user) {
    // check email
    if (!(await isValidEmail({ email, res }))) {
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

    // set default role

    // restructure user roles to be inserted in GraphQL mutation
    const userRoles = allowedRoles.map((role: string) => ({ role }));

    const displayName = options?.displayName ?? email;
    const locale = options?.locale ?? ENV.AUTH_LOCALE_DEFAULT;
    const avatarUrl = getGravatarUrl(email);

    // create new user
    user = await insertUser({
      displayName,
      locale,
      roles: {
        data: userRoles,
      },
      disabled: ENV.AUTH_DISABLE_NEW_USERS,
      avatarUrl,
      email,
      defaultRole,
      metadata: options?.metadata || {},
    });
  }

  if (user?.disabled) {
    return res.boom.unauthorized('User is disabled');
  }

  // create ticket
  const ticket = `passwordlessEmail:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

  await gqlSdk.updateUser({
    id: user.id,
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
      link: `${ENV.AUTH_SERVER_URL}/verify?&ticket=${ticket}&type=signinPasswordless&redirectTo=${redirectTo}`,
      displayName: user.displayName,
      email,
      ticket,
      redirectTo,
      locale: user.locale ?? ENV.AUTH_LOCALE_DEFAULT,
      serverUrl: ENV.AUTH_SERVER_URL,
      clientUrl: ENV.AUTH_CLIENT_URL,
    },
  });

  return res.send('ok');
};
