import { RequestHandler } from 'express';
import { sendError } from '@/errors';
import { getNewRefreshToken, gqlSdk, generateRedirectUrl } from '@/utils';

export const verifyHandler: RequestHandler<
  {},
  {},
  {},
  { ticket?: string; type?: string; redirectTo?: string }
> = async (req, res) => {
  // TODO use Joi validation - but use res.redirect
  const { ticket, type, redirectTo } = req.query;

  if (!redirectTo) {
    return sendError(res, 'missing-redirection');
  }

  if (!ticket) {
    // TODO add a sendError redirection option
    const redirectUrl = generateRedirectUrl(redirectTo, {
      error: 'MissingVerificationTicket',
      errorDescription: 'Missing verification ticket',
    });

    return res.redirect(redirectUrl);
  }

  if (!type) {
    const redirectUrl = generateRedirectUrl(redirectTo, {
      error: 'MissingVerificationType',
      errorDescription: 'Missing verification type',
    });

    return res.redirect(redirectUrl);
  }

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
    const redirectUrl = generateRedirectUrl(redirectTo, {
      error: 'InvalidOrExpiredVerificationTicket',
      errorDescription: 'Invalid or expired verification ticket',
    });

    return res.redirect(redirectUrl);
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
