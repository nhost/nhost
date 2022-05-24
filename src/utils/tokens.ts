import { v4 as uuidv4 } from 'uuid';
import { gqlSdk } from '@/utils';
import { SignInResponse, Session } from '../types';
import { UserFieldsFragment } from './__generated__/graphql-request';
import { generateTicketExpiresAt } from './ticket';
import { ENV } from './env';
import { getUser } from './user';
import { createHasuraAccessToken } from './jwt';

function newRefreshExpiry() {
  const date = new Date();

  // cant return this becuase this will return a unix timestamp directly
  date.setSeconds(date.getSeconds() + ENV.AUTH_REFRESH_TOKEN_EXPIRES_IN);

  // instead we must return the js date object
  return date;
}

const updateRefreshTokenExpiry = async (refreshToken: string) => {
  await gqlSdk.getUsersByRefreshTokenAndUpdateRefreshTokenExpiresAt({
    refreshToken,
    expiresAt: new Date(newRefreshExpiry()),
  });

  return refreshToken;
};

export const getNewRefreshToken = async (
  userId: string,
  refreshToken = uuidv4()
) => {
  await gqlSdk.insertRefreshToken({
    refreshToken: {
      userId,
      refreshToken,
      expiresAt: new Date(newRefreshExpiry()),
    },
  });

  return refreshToken;
};

/**
 * Get new or update current user session
 *
 * @param userAndToken - User field fragment and current refresh token if any
 * @returns Returns new user session if no valid current refresh token is passed, otherwise update current session
 */
export const getNewOrUpdateCurrentSession = async ({
  user,
  currentRefreshToken,
}: {
  user: UserFieldsFragment;
  currentRefreshToken?: string;
}): Promise<Session> => {
  // update user's last seen
  gqlSdk.updateUser({
    id: user.id,
    user: {
      lastSeen: new Date(),
    },
  });

  const sessionUser = await getUser({ userId: user.id });

  const accessToken = await createHasuraAccessToken(user);
  const refreshToken =
    (currentRefreshToken &&
      (await updateRefreshTokenExpiry(currentRefreshToken))) ||
    (await getNewRefreshToken(user.id));

  return {
    accessToken,
    accessTokenExpiresIn: ENV.AUTH_ACCESS_TOKEN_EXPIRES_IN,
    refreshToken,
    user: sessionUser,
  };
};

export const getSignInResponse = async ({
  userId,
  checkMFA,
}: {
  userId: string;
  checkMFA: boolean;
}): Promise<SignInResponse> => {
  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (!user) {
    throw new Error('No user');
  }

  if (checkMFA && user?.activeMfaType === 'totp') {
    // generate new ticket
    const ticket = `mfaTotp:${uuidv4()}`;

    // set ticket
    await gqlSdk.updateUser({
      id: userId,
      user: {
        ticket,
        ticketExpiresAt: generateTicketExpiresAt(5 * 60),
      },
    });

    return {
      session: null,
      mfa: {
        ticket,
      },
    };
  }

  const session = await getNewOrUpdateCurrentSession({ user });

  return {
    session,
    mfa: null,
  };
};
