import { RequestHandler } from 'express';
import {
  getNewRefreshToken,
  gqlSdk,
  generateRedirectUrl,
  getUserByEmail,
} from '@/utils';
import { Joi, redirectTo } from '@/validation';
import { sendError } from '@/errors';
import { EmailType, EMAIL_TYPES } from '@/types';

export const verifySchema = Joi.object({
  redirectTo: redirectTo.required(),
  ticket: Joi.string().required(),
  type: Joi.string()
    .allow(...Object.values(EMAIL_TYPES))
    .required(),
}).meta({ className: 'VerifySchema' });

export const verifyHandler: RequestHandler<
  {},
  {},
  {},
  {
    ticket: string;
    type: EmailType;
    redirectTo: string;
  }
> = async (req, res) => {
  const { ticket, type, redirectTo } = req.query;

  // get the user from the ticket
  const user = await gqlSdk
    .users({
      where: {
        _and: [
          {
            ticket: {
              _eq: ticket,
            },
          },
          {
            ticketExpiresAt: {
              _gt: new Date(),
            },
          },
        ],
      },
    })
    .then((gqlRes) => gqlRes.users[0]);

  if (!user) {
    return sendError(res, 'invalid-ticket', { redirectTo });
  }

  // user found, delete current ticket
  await gqlSdk.updateUser({
    id: user.id,
    user: {
      ticket: null,
    },
  });

  // different types
  if (type === EMAIL_TYPES.VERIFY) {
    await gqlSdk.updateUser({
      id: user.id,
      user: {
        emailVerified: true,
      },
    });
  } else if (type === EMAIL_TYPES.CONFIRM_CHANGE) {
    // * Send an error if the new email is already used by another user
    // * This check is also done when requesting a new email, but is done again here as
    // * an account with `newEmail` as an email could have been created since the email change occurred
    if (await getUserByEmail(user.newEmail)) {
      return sendError(res, 'email-already-in-use', { redirectTo });
    }
    // set new email for user
    await gqlSdk.updateUser({
      id: user.id,
      user: {
        email: user.newEmail,
        newEmail: null,
      },
    });
  } else if (type === EMAIL_TYPES.SIGNIN_PASSWORDLESS) {
    await gqlSdk.updateUser({
      id: user.id,
      user: {
        emailVerified: true,
      },
    });
  } else if (type === EMAIL_TYPES.PASSWORD_RESET) {
    // noop
    // just redirecting the user to the client (as signed-in).
  }

  const refreshToken = await getNewRefreshToken(user.id);

  // ! temparily send the refresh token in both hash and query parameter
  // TODO at a later stage, only send as a query parameter
  const redirectUrl = generateRedirectUrl(
    redirectTo,
    { refreshToken, type },
    `refreshToken=${refreshToken}&type=${type}`
  );

  return res.redirect(redirectUrl);
};
