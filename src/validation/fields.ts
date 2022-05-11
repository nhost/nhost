import { pwnedPassword } from 'hibp';

import { ENV } from '../utils/env';

import { Joi } from './joi';
import { EmailValidator } from './validators';

export const uuidRegex =
  /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/;

export const password = Joi.string().example('Str0ngPassw#ord-94|%');

export const passwordInsert = password
  .min(ENV.AUTH_PASSWORD_MIN_LENGTH)
  .description(
    `A password of minimum ${ENV.AUTH_PASSWORD_MIN_LENGTH} characters`
  )
  .external(async (value) => {
    if (ENV.AUTH_PASSWORD_HIBP_ENABLED && (await pwnedPassword(value))) {
      throw new Joi.ValidationError(
        'Password is too weak (it has been pnwed)',
        [],
        value
      );
    } else return value;
  }, `When HIBP is enabled, will check if the password is too weak`);

export const email = Joi.string()
  .email()
  .custom(EmailValidator)
  .example('john.smith@nhost.io')
  .description('A valid email');

export const locale = Joi.string()
  .length(2)
  // TODO reactivate ENV.AUTH_LOCALE_ALLOWED_LOCALES check
  // * For the moment, the Nhost console does not allow selecting activated locales.
  // * Once it will be possible, we will need to reactivate this check to make sure an undeclared locale falls back to the default one, but tries it all the way
  // * As an example: if 'fr' is not in the allowed locales, it is currently passed on all the way.
  // * In reactivating the following code, it will then fall back to the default locale (en) and for instance use the english email templates
  // .valid(...ENV.AUTH_LOCALE_ALLOWED_LOCALES)
  // .failover(ENV.AUTH_LOCALE_DEFAULT)
  .default(ENV.AUTH_LOCALE_DEFAULT)
  .example(ENV.AUTH_LOCALE_DEFAULT)
  .description(`A two-characters locale`);

export const defaultRole = Joi.string()
  .default(ENV.AUTH_USER_DEFAULT_ROLE)
  .example(ENV.AUTH_USER_DEFAULT_ROLE)
  .valid(...ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES);

export const allowedRoles = Joi.array()
  .items(...ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES)
  .default(ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES)
  .example(ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES);

export const displayName = Joi.string().example('John Smith');

export const metadata = Joi.object().default({}).example({
  firstName: 'John',
  lastName: 'Smith',
});

export const redirectTo = Joi.alternatives()
  .default(ENV.AUTH_CLIENT_URL)
  .try(
    ...ENV.AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS.map((value) =>
      Joi.string()
        .lowercase()
        .regex(new RegExp('^' + value))
    ),
    Joi.string()
      .lowercase()
      .regex(new RegExp('^' + ENV.AUTH_CLIENT_URL))
  )
  .example(`${ENV.AUTH_CLIENT_URL}/catch-redirection`);

export const uuid = Joi.string()
  .regex(uuidRegex)
  .example('2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24')
  .description('A valid UUID');

export const jwt = Joi.string()
  .regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/)
  .example(
    'eyJhbGciOiJIUzI1NiJ9.eyJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsibWUiLCJ1c2VyIl0sIngtaGFzdXJhLWRlZmF1bHQtcm9sZSI6InVzZXIiLCJ4LWhhc3VyYS11c2VyLWlkIjoiODAwYjA2ZWYtNGMyYi00NjQwLWIyMjAtNWZlNjk3ZWNjZGM2IiwieC1oYXN1cmEtdXNlci1pcy1hbm9ueW1vdXMiOiJmYWxzZSJ9LCJzdWIiOiI4MDBiMDZlZi00YzJiLTQ2NDAtYjIyMC01ZmU2OTdlY2NkYzYiLCJpc3MiOiJoYXN1cmEtYXV0aCIsImlhdCI6MTY1MTg2NTkwMCwiZXhwIjoxNjUxODY2ODAwfQ.IvFIMXOe6J21fyEfPkP9Caim3C_uAD2qimK4oGpNm44'
  )
  .description('A valid JWT token');

export const userId = uuid.description('Id of the user');

export const refreshToken = uuid
  .required()
  .description(
    'Refresh token during authentication or when refreshing the JWT'
  );

export const token = jwt.optional().description('Access token');

export const registrationOptions = Joi.object({
  locale,
  defaultRole,
  allowedRoles,
  displayName,
  metadata,
  redirectTo,
})
  .default()
  .custom((value, helper) => {
    const { allowedRoles, defaultRole } = value;
    if (!allowedRoles.includes(defaultRole)) {
      return helper.error('Default role must be part of allowed roles');
    }
    // check if allowedRoles is a subset of allowed user roles
    if (
      !allowedRoles.every((role: string) =>
        ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES.includes(role)
      )
    ) {
      return helper.error('Allowed roles must be a subset of allowedRoles');
    }
    return value;
  });

export const mfaTotpTicketPattern = new RegExp(`mfaTotp:${uuidRegex.source}`);

export const activeMfaType = Joi.alternatives()
  .try(
    Joi.string().valid('').empty('').default(null), // accept only empty strings and convert those to null
    Joi.string().valid('totp')
  )
  .example('totp')
  .description(
    'Multi-factor authentication type. A null value deactivates MFA'
  );
