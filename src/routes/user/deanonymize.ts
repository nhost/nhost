import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';
import { pwnedPassword } from 'hibp';
import { v4 as uuidv4 } from 'uuid';

import { getUserByEmail, hashPassword } from '@/helpers';
import { gqlSdk } from '@/utils/gqlSDK';
import { generateTicketExpiresAt } from '@/utils/ticket';
import { REGISTRATION } from '@config/registration';
import { emailClient } from '@/email';
import { APPLICATION } from '@config/application';
import { AUTHENTICATION } from '@config/authentication';
import { isPasswordValid } from '@/utils/password';
import { isValidEmail } from '@/utils/email';
import { ENV } from '@/utils/env';
import { isRolesValid } from '@/utils/roles';
import { getOtpData } from '@/utils/otp';

type BodyType = {
  signInMethod: 'email-password' | 'magic-link';
  email: string;
  password?: string;
  allowedRoles: string[];
  defaultRole: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const userDeanonymizeHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  // check if user is logged in
  if (!req.auth?.userId) {
    return res.boom.unauthorized('User not logged in');
  }

  const { body } = req;
  const { signInMethod, email, password } = req.body;

  if (!['email-password', 'magic-link'].includes(signInMethod)) {
    return res.boom.badRequest(
      'Incorrect sign in method. Must be one of [email-password, magic-link].'
    );
  }

  const { userId } = req.auth;

  const { user } = await gqlSdk.user({
    id: userId,
  });

  // we don't use the `isAnonymous` from the middeware because it might be out
  // dated (old jwt token) if you make this request multiple times in a short amount of time
  if (user?.isAnonymous !== true) {
    return res.boom.badRequest('Logged in user is not anonymous');
  }

  // check email
  if (!(await isValidEmail({ email, res }))) {
    // function send potential error via `res`
    return;
  }

  // check if email already in use by some other user
  if (await getUserByEmail(email)) {
    return res.boom.conflict('Email already in use');
  }

  // checks for email-password sign in method
  if (signInMethod === 'email-password') {
    // check password
    if (!(await isPasswordValid({ password, res }))) {
      // function send potential error via `res`
      return;
    }
  }

  // check roles
  const defaultRole = body.defaultRole ?? ENV.DEFAULT_USER_ROLE;
  const allowedRoles = body.allowedRoles ?? ENV.DEFAULT_ALLOWED_USER_ROLES;
  if (!(await isRolesValid({ defaultRole, allowedRoles, res }))) {
    return;
  }

  // password is null if password is not set
  // if password is null we're using sign in method magic link
  const passwordHash = password ? await hashPassword(password) : null;

  const userRoles = allowedRoles.map((role: string) => ({ role, userId }));

  let ticket, otp;

  // set ticket or otpHash depending on sign in method
  if (signInMethod === 'email-password') {
    ticket = `userActivate:${uuidv4()}`;
    const ticketExpiresAt = generateTicketExpiresAt(60 * 60);

    await gqlSdk.updateUser({
      id: userId,
      user: {
        isActive: ENV.AUTO_ACTIVATE_NEW_USERS,
        emailVerified: false,
        email,
        passwordHash,
        defaultRole,
        ticket,
        ticketExpiresAt,
        isAnonymous: false,
      },
    });
  } else if (signInMethod === 'magic-link') {
    const otpData = await getOtpData();

    otp = otpData.otp;
    const otpHash = otpData.otpHash;
    const otpHashExpiresAt = otpData.otpHashExpiresAt;

    await gqlSdk.updateUser({
      id: userId,
      user: {
        isActive: true,
        emailVerified: false,
        email,
        passwordHash: null,
        defaultRole,
        otpHash,
        otpHashExpiresAt,
        isAnonymous: false,
      },
    });
  } else {
    throw new Error('Incorrect state (signInMethod)');
  }

  if (!user) {
    throw new Error('Unable to get user');
  }

  // delete existing (anonymous) user roles
  await gqlSdk.deleteUserRolesByUserId({
    userId,
  });

  // insert new user roles (userRoles)
  await gqlSdk.insertUserRoles({
    userRoles,
  });

  // delete all pervious refresh tokens for user
  await gqlSdk.deleteUserRefreshTokens({
    userId,
  });

  // send email
  if (signInMethod === 'email-password') {
    if (!REGISTRATION.AUTO_ACTIVATE_NEW_USERS && AUTHENTICATION.VERIFY_EMAILS) {
      if (!APPLICATION.EMAILS_ENABLED) {
        throw new Error('SMTP settings unavailable');
      }

      await emailClient.send({
        template: 'activate-user',
        message: {
          to: email,
          headers: {
            'x-ticket': {
              prepared: true,
              value: ticket as string,
            },
            'x-email-template': {
              prepared: true,
              value: 'activate-user',
            },
          },
        },
        locals: {
          displayName: user.displayName,
          ticket,
          url: APPLICATION.SERVER_URL,
          locale: user.locale,
        },
      });
    }
  } else if (signInMethod === 'magic-link') {
    if (!APPLICATION.EMAILS_ENABLED) {
      throw new Error('SMTP settings unavailable');
    }

    await emailClient.send({
      template: 'magic-link',
      message: {
        to: email,
        headers: {
          'x-otp': {
            prepared: true,
            value: otp as string,
          },
          'x-email-template': {
            prepared: true,
            value: 'magic-link',
          },
        },
      },
      locals: {
        email,
        locale: user.locale,
        token: ticket,
        url: APPLICATION.SERVER_URL,
        appUrl: APPLICATION.APP_URL,
      },
    });
  } else {
    throw new Error('Invalid state.');
  }

  return res.send('OK');
};
