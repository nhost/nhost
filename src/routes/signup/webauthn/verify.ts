import { sendError, sendUnspecifiedError } from '@/errors';
import {
  ENV,
  getSignInResponse,
  verifyWebAuthnRegistration,
  gqlSdk,
  createVerifyEmailTicket,
  createEmailRedirectionLink,
  getUserByEmail,
  getCurrentChallenge,
} from '@/utils';
import { RequestHandler } from 'express';

import { RegistrationCredentialJSON } from '@simplewebauthn/typescript-types';
import { Joi, redirectTo, uuid } from '@/validation';
import {
  EMAIL_TYPES,
  SignInResponse,
  UserRegistrationOptionsWithRedirect,
} from '@/types';
import { emailClient } from '@/email';

export type SignUpVerifyWebAuthnRequestBody = {
  credential: RegistrationCredentialJSON;
  userId: string;
  options: Pick<UserRegistrationOptionsWithRedirect, 'redirectTo'> & {
    nickname?: string;
  };
};

export type SignUpVerifyWebAuthnResponseBody = SignInResponse;

export const signUpVerifyWebauthnSchema =
  Joi.object<SignUpVerifyWebAuthnRequestBody>({
    userId: uuid.required(),
    credential: Joi.object().required(),
    options: Joi.object({
      redirectTo,
      nickname: Joi.string().optional(),
    }).default(),
  }).meta({ className: 'SignUpVerifyWebauthnSchema' });

export const signInVerifyWebauthnHandler: RequestHandler<
  {},
  SignUpVerifyWebAuthnResponseBody,
  SignUpVerifyWebAuthnRequestBody
> = async (
  {
    body: {
      credential,
      userId,
      options: { redirectTo, nickname },
    },
  },
  res
) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  const { user } = await gqlSdk.user({ id: userId });

  if (!user) {
    return sendError(res, 'user-not-found');
  }

  // Edge case: if another user registered with the same email while the webauthn requester is between the first and second step
  if (await getUserByEmail(user.newEmail)) {
    return sendError(res, 'email-already-in-use');
  }

  await getCurrentChallenge(userId);

  try {
    await verifyWebAuthnRegistration(user, credential, nickname);

    await gqlSdk.updateUser({
      id: userId,
      user: {
        isAnonymous: false,
        email: user.newEmail,
        newEmail: null,
      },
    });

    if (user.disabled) {
      return sendError(res, 'disabled-user');
    }

    if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED && !user.emailVerified) {
      // TODO reuse this code in other places
      // create ticket
      const { ticket, ticketExpiresAt } = createVerifyEmailTicket();

      await gqlSdk.updateUser({
        id: userId,
        user: {
          ticket,
          ticketExpiresAt,
        },
      });
      const template = 'email-verify';
      const link = createEmailRedirectionLink(
        EMAIL_TYPES.VERIFY,
        ticket,
        redirectTo
      );
      await emailClient.send({
        template,
        message: {
          to: user.newEmail,
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
            'x-link': {
              prepared: true,
              value: link,
            },
          },
        },
        locals: {
          link,
          displayName: user.displayName,
          email: user.newEmail,
          newEmail: user.newEmail,
          ticket: ticket,
          redirectTo: encodeURIComponent(redirectTo),
          locale: user.locale ?? ENV.AUTH_LOCALE_DEFAULT,
          serverUrl: ENV.AUTH_SERVER_URL,
          clientUrl: ENV.AUTH_CLIENT_URL,
        },
      });

      return res.send({ session: null, mfa: null });
    }
    const signInResponse = await getSignInResponse({
      userId: user.id,
      checkMFA: false,
    });
    return res.send(signInResponse);
  } catch (e) {
    return sendUnspecifiedError(res, e);
  }
};
