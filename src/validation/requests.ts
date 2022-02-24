import Joi from 'joi';
import {
  locale,
  defaultRole,
  allowedRoles,
  displayName,
  metadata,
  email,
  password,
  redirectTo,
  refreshToken,
  userId,
  uuidRegex,
  uuid,
} from './fields';

const registrationOptions = Joi.object({
  locale,
  defaultRole,
  allowedRoles,
  displayName,
  metadata,
});

export const signUpEmailPasswordSchema = Joi.object({
  email: email.required(),
  password: password.required(),
  options: registrationOptions.keys({
    redirectTo,
  }),
}).meta({ className: 'SignUpEmailPasswordSchema' });

// Sign In
export const signInEmailPasswordSchema = Joi.object({
  email: email.required(),
  password: password.required(),
  options: Joi.object({
    defaultRole: defaultRole,
    allowedRoles: allowedRoles,
    displayName: displayName,
  }),
}).meta({ className: 'SignInEmailPasswordSchema' });

export const signInPasswordlessEmailSchema = Joi.object({
  email: email.required(),
  options: registrationOptions.keys({
    redirectTo,
  }),
}).meta({ className: 'SignInPasswordlessEmailSchema' });

export const signInPasswordlessSmsSchema = Joi.object({
  phoneNumber: Joi.string().required(),
  options: registrationOptions,
}).meta({ className: 'SignInPasswordlessSmsSchema' });

export const signInOtpSchema = Joi.object({
  phoneNumber: Joi.string().required(),
  otp: Joi.string().required(),
}).meta({ className: 'SignInOtpSchema' });

const mfaTotpTicketPattern = new RegExp(`mfaTotp:${uuidRegex.source}`);
export const signInMfaTotpSchema = Joi.object({
  ticket: Joi.string()
    .regex(mfaTotpTicketPattern)
    .required()
    .example('mfaTotp:e08204c7-40af-4434-a7ed-31c6aa37a390'),
  otp: Joi.string().required(),
}).meta({ className: 'SignInMfaTotpSchema' });

export const signInMfaPhoneNumberSchema = Joi.object({
  phoneNumber: Joi.string().required(),
  code: Joi.string().required(),
}).meta({ className: 'SignInMfaPhoneNumberSchema' });

export const signInAnonymousSchema = Joi.object({
  locale: locale,
  displayName: displayName,
  metadata: metadata,
}).meta({ className: 'SignInMfaPhoneNumberSchema' });

// -- SIGN OUT--
export const signOutSchema = Joi.object({
  refreshToken,
  all: Joi.boolean()
    .default(false)
    .description('Sign out from all connected devices'),
}).meta({ className: 'SignOutSchema' });

// -- USER --

export const userPasswordResetSchema = Joi.object({
  email: email.required(),
  options: Joi.object({
    redirectTo,
  }),
}).meta({ className: 'UserPasswordResetSchema' });

export const userPasswordSchema = Joi.object({
  newPassword: password.required(),
}).meta({ className: 'UserPasswordSchema' });

export const userEmailChangeSchema = Joi.object({
  newEmail: email,
  options: Joi.object({
    redirectTo,
  }),
}).meta({ className: 'UserEmailChangeSchema' });

export const userEmailSendVerificationEmailSchema = Joi.object({
  email: email.required(),
  options: Joi.object({
    redirectTo,
  }),
}).meta({ className: 'UserEmailSendVerificationEmailSchema' });

// MFA
export const userMfaSchema = Joi.object({
  code: Joi.string().required().description('MFA activation code'),
  activeMfaType: Joi.string()
    .allow('totp')
    .example('totp')
    .description(
      'Multi-factor authentication type. A null value deactivates MFA'
    ),
}).meta({ className: 'UserMfaSchema' });

// Deanonymize
// TODO should work with any other authentication methods e.g. Oauth
export const userDeanonymizeSchema = Joi.object({
  signInMethod: Joi.string()
    .allow('email-password')
    .allow('passwordless')
    .required()
    .example('email-password'),
  email: email.required(),
  password,
  connection: Joi.string().allow('email', 'sms').example('email'),
  defaultRole,
  allowedRoles,
}).meta({ className: 'UserDeanonymizeSchema' });

// user provider tokens
export const userProviderTokensSchema = Joi.object({
  providerId: Joi.string().required(),
  userId,
}).meta({ className: 'UserProviderTokensSchema' });

// -- TOKEN --

export const tokenSchema = Joi.object({
  refreshToken,
}).meta({ className: 'TokenSchema' });

// -----------

export const providerQuery = Joi.object({
  redirectUrl: Joi.string(),
});

export type ProviderQuery = {
  redirectUrl?: string;
};

export const providerCallbackQuery = Joi.object({
  state: uuid.required(),
}).unknown(true);

export type ProviderCallbackQuery = Record<string, unknown> & {
  state: string;
};
