import { Response } from 'express';
import * as EmailValidator from 'email-validator';

import { ENV } from './env';

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

  // of no access control is set, allow all emails
  if (
    ENV.AUTH_ACCESS_CONTROL_ALLOW_LIST.length === 0 &&
    ENV.AUTH_ACCESS_CONTROL_BLOCK_LIST.length === 0
  ) {
    return true;
  }

  const emailDomain = email.split('@')[1];

  // check blocked first
  const blockedDomains: string[] = [];
  const blockedEmails: string[] = [];

  ENV.AUTH_ACCESS_CONTROL_BLOCK_LIST.filter((item) => {
    if (item.startsWith('*@')) {
      // add allowed domain without the first `*@`
      blockedDomains.push(item.substring(2));
    } else {
      // otherwise, treat the item as an email
      blockedEmails.push(item);
    }
  });

  // check if blocked
  if (blockedDomains.includes(emailDomain)) {
    res.boom.forbidden('Email is not allowed');
    return false;
  }

  if (blockedEmails.includes(email)) {
    res.boom.forbidden('Email is not allowed');
    return false;
  }

  // We've now checked the block list.
  // If ther eis no entry in the allow list it means we can allow the email
  if (ENV.AUTH_ACCESS_CONTROL_ALLOW_LIST.length === 0) {
    return true;
  }

  // The allow list is not empty. We'll now go ahead and check if the email is
  // allowed. Otherwise, we'll default to false.

  // get allowed domains from environment variable
  const allowedDomains: string[] = [];
  const allowedEmails: string[] = [];

  ENV.AUTH_ACCESS_CONTROL_ALLOW_LIST.filter((item) => {
    if (item.startsWith('*@')) {
      // add allowed domain without the first `*@`
      allowedDomains.push(item.substring(2));
    } else {
      // otherwise, treat the item as an email
      allowedEmails.push(item);
    }
  });

  console.log({ emailDomain });
  console.log({ allowedDomains });

  if (allowedDomains.includes(emailDomain)) {
    return true;
  }

  if (allowedEmails.includes(email)) {
    return true;
  }

  res.boom.forbidden('Email is not allowed');
  return false;
};
