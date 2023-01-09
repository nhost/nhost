import { ENV } from '../env';
import { generateTicketExpiresAt } from '../ticket';
import { v4 as uuidv4 } from 'uuid';
import { insertUser } from './insert';
import { getGravatarUrl } from '../avatar';
import {
  EMAIL_TYPES,
  User,
  UserRegistrationOptionsWithRedirect,
} from '@/types';
import { hashPassword } from '../password';
import { sendEmail } from '@/email';
import { createEmailRedirectionLink } from '../redirect';
import { getUserByEmail } from './getters';

const sendEmailIfNotVerified = async ({
  email,
  newEmail,
  user,
  displayName,
  ticket,
  redirectTo,
}: {
  email: string;
  newEmail: string | null;
  user: NonNullable<User>;
  displayName: string;
  ticket?: string | null;
  redirectTo: string;
}) => {
  if (
    !ENV.AUTH_DISABLE_NEW_USERS &&
    ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED &&
    !user.emailVerified
  ) {
    if (!ticket) {
      throw Error(`No ticket found for the user ${user.id}`);
    }

    const template = 'email-verify';
    const link = createEmailRedirectionLink(
      EMAIL_TYPES.VERIFY,
      ticket,
      redirectTo
    );
    await sendEmail({
      template,
      message: {
        to: email,
        headers: {
          /** @deprecated */
          'x-ticket': {
            prepared: true,
            value: ticket,
          },
          /** @deprecated */
          'x-redirect-to': {
            prepared: true,
            value: redirectTo,
          },
          'x-email-template': {
            prepared: true,
            value: template,
          },
          'x-link': {
            prepared: true,
            value: link,
          },
        },
      },
      locals: {
        link,
        displayName,
        email,
        newEmail: newEmail,
        ticket,
        redirectTo: encodeURIComponent(redirectTo),
        locale: user.locale,
        serverUrl: ENV.AUTH_SERVER_URL,
        clientUrl: ENV.AUTH_CLIENT_URL,
      },
    });
  }
};

export const createUserAndSendVerificationEmail = async (
  email: string,
  options: UserRegistrationOptionsWithRedirect,
  password?: string
) => {
  const {
    redirectTo,
    locale,
    defaultRole,
    allowedRoles,
    metadata,
    displayName = email,
  } = options;

  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    await sendEmailIfNotVerified({
      email,
      newEmail: email,
      user: existingUser,
      displayName,
      ticket: existingUser.ticket,
      redirectTo,
    });

    return existingUser;
  }

  // hash password
  const passwordHash = password && (await hashPassword(password));

  // create ticket
  // TODO use createVerifyEmailTicket()
  const ticket = `verifyEmail:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60 * 24 * 30); // 30 days

  // insert user
  const user = await insertUser({
    disabled: ENV.AUTH_DISABLE_NEW_USERS,
    displayName,
    avatarUrl: getGravatarUrl(email),
    email,
    passwordHash,
    ticket,
    ticketExpiresAt,
    emailVerified: false,
    locale,
    defaultRole,
    roles: allowedRoles,
    metadata,
  });

  await sendEmailIfNotVerified({
    email,
    newEmail: user.newEmail,
    user,
    displayName,
    ticket,
    redirectTo,
  });

  return user;
};
