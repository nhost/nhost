// ! Keep dotent.config at the very beginning of the file!!!
import dotenv from 'dotenv';
// Load '.env' file if production mode, '.env.<NODE_ENV>' otherwise
const envFile =
  process.env.NODE_ENV && process.env.NODE_ENV !== 'production'
    ? `.env.${process.env.NODE_ENV}`
    : '.env';
dotenv.config({ path: envFile });

export * from '@config/authentication';
export * from '@config/headers';
export * from '@config/token';
export * from '@config/providers';
export * from '@config/mfa';
