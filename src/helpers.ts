import { NextFunction, Response, Request } from 'express';
import * as gravatar from 'gravatar';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { gqlSdk } from './utils/gqlSDK';
// import { UserFieldsFragment } from './utils/__generated__/graphql-request';
import { ENV } from './utils/env';

/**
 * Create QR code.
 * @param secret Required OTP secret.
 */
export function createQR(secret: string): Promise<string> {
  return QRCode.toDataURL(secret);
}

/**
 * This wrapper function sends any route errors to `next()`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asyncWrapper(fn: any) {
  return function (req: Request, res: Response, next: NextFunction): void {
    fn(req, res, next).catch(next);
  };
}

export const getUserByEmail = async (email: string) => {
  const { users } = await gqlSdk.users({
    where: {
      email: {
        _eq: email,
      },
    },
  });

  return users[0];
};

export const getUserByTicket = async (ticket: string) => {
  const now = new Date();

  const { users } = await gqlSdk.users({
    where: {
      _and: [
        {
          ticket: {
            _eq: ticket,
          },
        },
        {
          ticketExpiresAt: {
            _gt: now,
          },
        },
      ],
    },
  });

  if (users.length !== 1) {
    return null;
  }

  return users[0];
};

// TODO await request returns undefined if no user found!
export const getUserById = async (userId: string | undefined) => {
  if (!userId) {
    throw new Error('User does not exists');
  }

  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (!user) {
    throw new Error('User does not exists');
  }

  return user;
};

/**
 * Password hashing function.
 * @param password Password to hash.
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

export function newRefreshExpiry() {
  const date = new Date();
  date.setSeconds(date.getSeconds() + ENV.AUTH_REFRESH_TOKEN_EXPIRES_IN);
  return date;
}

export const userWithEmailExists = async (email: string) => {
  return !!(await getUserByEmail(email));
};

export const userIsAnonymous = async (userId: string) => {
  const { user } = await gqlSdk.user({
    id: userId,
  });

  return user?.isAnonymous;
};

export const getGravatarUrl = (email?: string) => {
  if (ENV.AUTH_GRAVATAR_ENABLED && email) {
    return gravatar.url(email, {
      r: ENV.AUTH_GRAVATAR_RATING,
      protocol: 'https',
      default: ENV.AUTH_GRAVATAR_DEFAULT,
    });
  }
};

// export function userToSessionUser(user: UserFieldsFragment): SessionUser {
//   return {
//     id: user.id,
//     email: user.email,
//     displayName: user.displayName,
//     avatarUrl: user.avatarUrl,
//   };
// }

export function getRandomInt(min: number, max: number): number {
  // Create byte array and fill with 1 random number
  const byteArray = new Uint8Array(1);
  crypto.getRandomValues(byteArray);

  const range = max - min + 1;
  const max_range = 256;
  if (byteArray[0] >= Math.floor(max_range / range) * range)
    return getRandomInt(min, max);
  return min + (byteArray[0] % range);
}

export function getNewPasswordlessCode() {
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += getRandomInt(0, 9);
  }
  return otp;
}

export function isValidRedirectTo({
  redirectTo,
}: {
  redirectTo: string;
}): boolean {
  if (!redirectTo) {
    return false;
  }

  if (redirectTo.startsWith(ENV.AUTH_CLIENT_URL)) {
    return true;
  }

  if (ENV.AUTH_ALLOWED_REDIRECT_URLS.includes(redirectTo)) {
    return true;
  }

  return false;
}
