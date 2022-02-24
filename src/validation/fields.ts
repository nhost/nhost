import Joi from 'joi';
import { ENV } from '../utils/env';

export const uuidRegex =
  /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/;

export const password = Joi.string()
  .example('Str0ngPassw#ord-94|%')
  .min(ENV.AUTH_PASSWORD_MIN_LENGTH)
  // TODO handle async validation in express-joi-validation
  // .external(async (value) => {
  //   if (ENV.AUTH_PASSWORD_HIBP_ENABLED && (await pwnedPassword(value))) {
  //     throw Error('Password is too weak (it has been pnwed)');
  //   }
  // })
  .description(
    // TODO describe HIBP
    `A password of minimum ${ENV.AUTH_PASSWORD_MIN_LENGTH} characters`
  );

// TODO validate allow domains etc
export const email = Joi.string()
  .email()
  .example('john.smith@nhost.io')
  .description('A valid email'); //.required(); //.allowedDomains();

export const locale = Joi.string()
  .length(2)
  .example('en')
  .description(`A two-characters locale`)
  .valid(...ENV.AUTH_LOCALE_ALLOWED_LOCALES);

export const defaultRole = Joi.string()
  .example('user')
  .valid(...ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES);

export const allowedRoles = Joi.array()
  .items(Joi.string())
  .example(['user', 'me'])
  .valid(...ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES);

export const displayName = Joi.string().example('John Smith');

export const metadata = Joi.object().example({
  firstName: 'John',
  lastName: 'Smith',
});

export const redirectTo = Joi.string()
  .regex(new RegExp('^' + ENV.AUTH_CLIENT_URL))
  .example(`${ENV.AUTH_CLIENT_URL}/catch-redirection`);

export const uuid = Joi.string()
  .regex(uuidRegex)
  .example('2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24')
  .description('A valid UUID');

export const userId = uuid.description('Id of the user');
export const refreshToken = uuid
  .required()
  .description(
    'Refresh token during authentication or when refreshing the JWT'
  );
