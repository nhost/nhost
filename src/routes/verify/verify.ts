import { ENV } from '@/utils/env';
import { gqlSdk } from '@/utils/gqlSDK';
import { getNewRefreshToken } from '@/utils/tokens';
import { Request, Response } from 'express';

export const verifyHandler = async (
  req: Request,
  res: Response
): Promise<unknown> => {
  // const { ticket, type } = req.query;
  const ticket = req.query.ticket as string;
  const type = req.query.type as string;

  if (!ticket) {
    return res.boom.badRequest('Missing ticket');
  }

  if (!type) {
    return res.boom.badRequest('Missing type');
  }

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
    return res.boom.unauthorized('Invalid or expired ticket');
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
  }

  const refreshToken = await getNewRefreshToken(user.id);

  // TODO: Get redirectTo url from user that can be set from the client. if
  // `redirectTo` is set, use that one instead of `AUTH_CLIENT_URL`
  return res.redirect(
    `${ENV.AUTH_CLIENT_URL}#refreshToken=${refreshToken}&type=${type}`
  );
};
