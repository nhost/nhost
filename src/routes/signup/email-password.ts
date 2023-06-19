import { RequestHandler } from 'express';

import { sendError } from '@/errors';
import { UserRegistrationOptionsWithRedirect } from '@/types';
import { ENV, getSignInResponse, getUserByEmail } from '@/utils';
import { createUserAndSendVerificationEmail } from '@/utils/user/email-verification';
import { Joi, email, passwordInsert, registrationOptions } from '@/validation';

export const signUpEmailPasswordSchema = Joi.object({
  email: email.required(),
  password: passwordInsert.required(),
  options: registrationOptions,
}).meta({ className: 'SignUpEmailPasswordSchema' });

export const signUpEmailPasswordHandler: RequestHandler<
  {},
  {},
  {
    email: string;
    password: string;
    options: UserRegistrationOptionsWithRedirect;
  }
> = async (req, res) => {
  const { body } = req;
  const { email, password, options } = body;

  // check if email already in use by some other user
  if (await getUserByEmail(email)) {
    return sendError(res, 'email-already-in-use');
  }

  const user = await createUserAndSendVerificationEmail(
    email,
    options,
    password
  );

  // SIGNIN_EMAIL_VERIFIED_REQUIRED = true => User must verify their email before signing in.
  // SIGNIN_EMAIL_VERIFIED_REQUIRED = false => User don't have to verify their email before signin in.
  if (ENV.AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED) {
    return res.send({ session: null, mfa: null });
  }

  const signInResponse = await getSignInResponse({
    userId: user.id,
    checkMFA: false,
  });

  return res.send(signInResponse);
};
