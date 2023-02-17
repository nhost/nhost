import { v4 as uuidv4 } from 'uuid';
import { gqlSdk } from '@/utils';
import { ENV } from './env';
import crypto from 'crypto';

/** Hash using SHA256, and prefix with \x so it matches the Postgres hexadecimal syntax */
const hash = (value: string) =>
  `\\x${crypto.createHash('sha256').update(value).digest('hex')}`;

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
      refreshToken,
      expiresAt: new Date(newRefreshExpiry()),
    },
  });
  return refreshToken;
};
