import { gqlSdk } from '@/utils';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ENV } from './env';

/** Hash using SHA256, and prefix with \x so it matches the Postgres hexadecimal syntax */
export const hash = (value: string) =>
  `\\x${crypto.createHash('sha256').update(value).digest('hex')}`;

export const getUserByPAT = async (pat: string) => {
  const result = await gqlSdk.getUsersByPAT({ patHash: hash(pat) });
  return result.authRefreshTokens[0]?.user;
};

export const getUserByRefreshToken = async (refreshToken: string) => {
  const result = await gqlSdk.getUsersByRefreshToken({
    refreshTokenHash: hash(refreshToken),
  });
  return result.authRefreshTokens[0]?.user;
};

export const deleteUserRefreshTokens = async (userId: string) => {
  await gqlSdk.deleteUserRefreshTokens({ userId });
};

export const deleteRefreshToken = async (refreshToken: string) => {
  // * delete both refresh token and its hash value
  await gqlSdk.deleteRefreshToken({
    refreshTokenHash: hash(refreshToken),
  });
};

const newRefreshExpiry = () => {
  const date = new Date();

  // cant return this becuase this will return a unix timestamp directly
  date.setSeconds(date.getSeconds() + ENV.AUTH_REFRESH_TOKEN_EXPIRES_IN);

  // instead we must return the js date object
  return date;
};

export const updateRefreshTokenExpiry = async (refreshToken: string) => {
  await gqlSdk.getUsersByRefreshTokenAndUpdateRefreshTokenExpiresAt({
    refreshTokenHash: hash(refreshToken),
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
      refreshTokenHash: hash(refreshToken),
      expiresAt: new Date(newRefreshExpiry()),
    },
  });
  return refreshToken;
};
