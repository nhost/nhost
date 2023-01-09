import { sendError, sendUnspecifiedError } from '@/errors';
import {
  ENV,
  getSignInResponse,
  verifyWebAuthnRegistration,
  createVerifyEmailTicket,
  createEmailRedirectionLink,
  getUserByEmail,
  pgClient,
} from '@/utils';
import { RequestHandler } from 'express';

import { RegistrationCredentialJSON } from '@simplewebauthn/typescript-types';
import { Joi, redirectTo } from '@/validation';
import {
  EMAIL_TYPES,
  SignInResponse,
  UserRegistrationOptionsWithRedirect,
} from '@/types';
import { sendEmail } from '@/email';

export type SignUpVerifyWebAuthnRequestBody = {
  credential: RegistrationCredentialJSON;
  options: Pick<UserRegistrationOptionsWithRedirect, 'redirectTo'> & {
    nickname?: string;
  };
};

export type SignUpVerifyWebAuthnResponseBody = SignInResponse;

export const signUpVerifyWebauthnSchema =
  Joi.object<SignUpVerifyWebAuthnRequestBody>({
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
      options: { redirectTo, nickname },
    },
  },
  res
) => {
  if (!ENV.AUTH_WEBAUTHN_ENABLED) {
    return sendError(res, 'disabled-endpoint');
  }

  let challenge: string;
  try {
    challenge = JSON.parse(
      Buffer.from(credential.response.clientDataJSON, 'base64').toString()
    ).challenge;
  } catch {
    return sendError(res, 'invalid-request', {
      customMessage: 'Could not parse challenge',
    });
  }

  const user = await pgClient.getUserByChallenge(challenge);
  if (!user) {
    return sendError(res, 'user-not-found');
  }
  const newEmail = user.newEmail;

  if (!newEmail) {
    return sendError(res, 'invalid-request', {
      customMessage: 'No new email found',
    });
  }

  // Edge case: if another user registered with the same email while the webauthn requester is between the first and second step
  if (await getUserByEmail(newEmail)) {
    return sendError(res, 'email-already-in-use');
  }

  try {
    await verifyWebAuthnRegistration(user, credential, nickname);

    await pgClient.updateUser({
      id: user.id,
      user: {
        isAnonymous: false,
        email: newEmail,
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

      await pgClient.updateUser({
        id: user.id,
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
      await sendEmail({
        template,
        message: {
          to: newEmail,
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
          email: newEmail,
          newEmail,
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
