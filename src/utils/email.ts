import { Response } from 'express';
import * as EmailValidator from 'email-validator';

import { ENV } from './env';

type IsValidEmailParams = {
  email: string;
  res?: Response;
};

// ok
export const isValidEmail = async ({
  email,
  res,
}: IsValidEmailParams): Promise<boolean> => {
  // check if email is valid
  if (!EmailValidator.validate(email)) {
    if (res) {
      console.log({ email });

      res.boom.badRequest('The email is not a valid email address');
    }
    return false;
  }

  // of no access control is set, allow all emails
  if (
    ENV.AUTH_ACCESS_CONTROL_ALLOWED_EMAILS.length === 0 &&
    ENV.AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS.length === 0 &&
    ENV.AUTH_ACCESS_CONTROL_BLOCKED_EMAILS.length === 0 &&
    ENV.AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS.length === 0
  ) {
    return true;
  }

  const emailDomain = email.split('@')[1];

  // check if email is blocked
  if (ENV.AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS.includes(emailDomain)) {
    if (res) {
      res.boom.forbidden('Email domain is not allowed');
    }
    return false;
  }

  if (ENV.AUTH_ACCESS_CONTROL_BLOCKED_EMAILS.includes(email)) {
    if (res) {
      res.boom.forbidden('Email is not allowed');
    }
    return false;
  }

  // We've now checked the block list.
  // If the allowed-lists are empty, all emails are allowed.
  if (
    ENV.AUTH_ACCESS_CONTROL_ALLOWED_EMAILS.length === 0 &&
    ENV.AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS.length === 0
  ) {
    return true;
  }

  // One of the allow lists are not empty.
  // The email must now either be allowed in one of the two lists.
  // if the email is not found in any list, we'll return false in this function.
  // because the email is not valid.

  if (ENV.AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
    return true;
  }

  if (ENV.AUTH_ACCESS_CONTROL_ALLOWED_EMAILS.includes(email)) {
    return true;
  }

  if (res) {
    res.boom.forbidden('Email is not allowed');
  }
  return false;
};
