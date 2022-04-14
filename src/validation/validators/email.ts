import { CustomValidator } from 'joi';

import { ENV } from '@/utils';

export const EmailValidator: CustomValidator = (email, helper) => {
  if (
    ENV.AUTH_ACCESS_CONTROL_ALLOWED_EMAILS.length === 0 &&
    ENV.AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS.length === 0 &&
    ENV.AUTH_ACCESS_CONTROL_BLOCKED_EMAILS.length === 0 &&
    ENV.AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS.length === 0
  ) {
    return email;
  }

  const emailDomain = email.split('@')[1];

  // check if email is blocked
  if (ENV.AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS.includes(emailDomain)) {
    return helper.error('Email is not valid');
  }

  if (ENV.AUTH_ACCESS_CONTROL_BLOCKED_EMAILS.includes(email)) {
    return helper.error('Email is not valid');
  }

  // We've now checked the block list.
  // If the allowed-lists are empty, all emails are allowed.
  if (
    ENV.AUTH_ACCESS_CONTROL_ALLOWED_EMAILS.length === 0 &&
    ENV.AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS.length === 0
  ) {
    return email;
  }

  // One of the allow lists are not empty.
  // The email must now either be allowed in one of the two lists.
  // if the email is not found in any list, we'll return false in this function.
  // because the email is not valid.

  if (ENV.AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
    return email;
  }

  if (ENV.AUTH_ACCESS_CONTROL_ALLOWED_EMAILS.includes(email)) {
    return email;
  }

  return helper.error('Email is not valid');
};
