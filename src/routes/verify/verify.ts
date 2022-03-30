import { RequestHandler } from 'express';
import { getNewRefreshToken, gqlSdk, generateRedirectUrl } from '@/utils';
import { Joi, redirectTo } from '@/validation';
import { sendError } from '@/errors';

export const verifySchema = Joi.object({
  redirectTo: redirectTo.required(),
  ticket: Joi.string().required(),
  type: Joi.string()
    .allow(
      'emailVerify',
      'emailConfirmChange',
      'signinPasswordless',
      'passwordReset'
    )
    .required(),
}).meta({ className: 'VerifySchema' });

export const verifyHandler: RequestHandler<
  {},
  {},
  {},
  { ticket: string; type: string; redirectTo: string }
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
  if (type === 'emailVerify') {
    await gqlSdk.updateUser({
      id: user.id,
      user: {
        emailVerified: true,
      },
    });
  } else if (type === 'emailConfirmChange') {
    // set new email for user
    await gqlSdk.updateUser({
      id: user.id,
      user: {
        email: user.newEmail,
        newEmail: null,
      },
    });
  } else if (type === 'signinPasswordless') {
    await gqlSdk.updateUser({
      id: user.id,
      user: {
        emailVerified: true,
      },
    });
  } else if (type === 'passwordReset') {
    // noop
    // just redirecting the user to the client (as signed-in).
  }

  const refreshToken = await getNewRefreshToken(user.id);

  const redirectUrl = generateRedirectUrl(
    redirectTo,
    {},
    `refreshToken=${refreshToken}&type=${type}`
  );

  return res.redirect(redirectUrl);
};
