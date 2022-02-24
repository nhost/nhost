import { Response } from 'express';
import { pwnedPassword } from 'hibp';
import { ENV } from './env';

type IsPasswordValidParams = {
  password: string | undefined;
  res: Response;
};

export const isPasswordValid = async ({
  password,
  res,
}: IsPasswordValidParams): Promise<boolean> => {
  // TODO move to Joi (tricky as express-joi-validation does not handle async validation)
  if (!password) {
    res.boom.badRequest(`Password is not set`);
    return false;
  }

  // check min length
  if (password.length < ENV.AUTH_PASSWORD_MIN_LENGTH) {
    res.boom.badRequest(
      `Password is too short. The password must be minimum ${ENV.AUTH_PASSWORD_MIN_LENGTH} chars.`
    );
    return false;
  }

  // check if compromised
  if (ENV.AUTH_PASSWORD_HIBP_ENABLED && (await pwnedPassword(password))) {
    res.boom.badRequest('Password is too weak.');
    return false;
  }

  return true;
};
