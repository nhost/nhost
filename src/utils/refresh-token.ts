import { ENV } from './env';
import crypto from 'crypto';

/** Hash using SHA256, and prefix with \x so it matches the Postgres hexadecimal syntax */
export const hashRefreshToken = (value: string) =>
  `\\x${crypto.createHash('sha256').update(value).digest('hex')}`;

export const newRefreshExpiry = () => {
  const date = new Date();

  // cant return this becuase this will return a unix timestamp directly
  date.setSeconds(date.getSeconds() + ENV.AUTH_REFRESH_TOKEN_EXPIRES_IN);

  // instead we must return the js date object
  return date;
};
