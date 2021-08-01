import { Response } from 'express';
import * as EmailValidator from 'email-validator';

import { gqlSdk } from './gqlSDK';
import { ENV } from './env';

export const isWhitelistedEmail = async (email: string) => {
  const { AuthWhitelist } = await gqlSdk.isWhitelistedEmail({
    email,
  });

  return !!AuthWhitelist;
};

type IsValidEmailParams = {
  email: string;
  res: Response;
};

// ok
export const isValidEmail = async ({
  email,
  res,
}: IsValidEmailParams): Promise<boolean> => {
  // check if email is valid
  if (!EmailValidator.validate(email)) {
    res.boom.badRequest('Invalid: newEmail is not a valid email address');
    return false;
  }

  // check if email domain is valid
  if (ENV.ALLOWED_EMAIL_DOMAINS.length > 0) {
    const emailDomain = email.split('@')[1];

    if (!ENV.ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
      res.boom.unauthorized('Email domain is not allowed');
      return false;
    }
  }

  // check if email is whitelisted
  if (ENV.WHITELIST_ENABLED && !(await isWhitelistedEmail(email))) {
    res.boom.unauthorized('Email is not allowed');
    return false;
  }

  return true;
};
