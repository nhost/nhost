import Joi from 'joi';

const uuidRegex =
  /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/;

const passwordRule = Joi.string();

const emailRule = Joi.string().email(); //.required(); //.allowedDomains();

const localeRule = Joi.string().length(2);

export const signUpEmailPasswordSchema = Joi.object({
  email: emailRule.required(),
  password: passwordRule.required(),
  options: Joi.object({
    locale: localeRule,
    defaultRole: Joi.string(),
    allowedRoles: Joi.array().items(Joi.string()),
    displayName: Joi.string(),
    redirectTo: Joi.string(),
  }),
});

// Sign In
export const signInEmailPasswordSchema = Joi.object({
  email: emailRule.required(),
  password: passwordRule.required(),
  options: Joi.object({
    locale: localeRule,
    defaultRole: Joi.string(),
    allowedRoles: Joi.array().items(Joi.string()),
    displayName: Joi.string(),
  }),
});

export const signInPasswordlessEmailSchema = Joi.object({
  email: emailRule.required(),
  options: Joi.object({
    locale: localeRule,
    defaultRole: Joi.string(),
    allowedRoles: Joi.array().items(Joi.string()),
    displayName: Joi.string(),
    redirectTo: Joi.string(),
  }),
});

export const signInPasswordlessSmsSchema = Joi.object({
  phoneNumber: Joi.string().required(),
  options: Joi.object({
    locale: localeRule,
    defaultRole: Joi.string(),
    allowedRoles: Joi.array().items(Joi.string()),
    displayName: Joi.string(),
  }),
});

export const signInOtpSchema = Joi.object({
  phoneNumber: Joi.string().required(),
  otp: Joi.string().required(),
});

const mfaTotpTicketPattern = new RegExp(`mfaTotp:${uuidRegex.source}`);
export const signInMfaTotpSchema = Joi.object({
  ticket: Joi.string().regex(mfaTotpTicketPattern).required(),
  otp: Joi.string().required(),
});

export const signInMfaPhoneNumberSchema = Joi.object({
  phoneNumber: Joi.string().required(),
  code: Joi.string().required(),
});

export const signInAnonymousSchema = Joi.object({
  locale: localeRule,
  displayName: Joi.string(),
});

// -- SIGN OUT--
export const signOutSchema = Joi.object({
  refreshToken: Joi.string().regex(uuidRegex).required(),
  all: Joi.boolean().default(false),
});

// -- USER --

export const userPasswordResetSchema = Joi.object({
  email: emailRule.required(),
});

export const userPasswordSchema = Joi.object({
  newPassword: Joi.string().required(),
});

export const userEmailChangeSchema = Joi.object({
  newEmail: emailRule,
  options: {
    redirecTo: Joi.string(),
  },
});

export const userEmailSendVerificationEmailSchema = Joi.object({
  email: emailRule.required(),
  options: {
    redirecTo: Joi.string(),
  },
});

const userActivateTicketPattern = new RegExp(
  `userActivate:${uuidRegex.source}`
);
export const userActivateSchema = Joi.object({
  ticket: Joi.string().regex(userActivateTicketPattern).required(),
});

// MFA
export const userMfaSchema = Joi.object({
  code: Joi.string().required(),
  activeMfaType: Joi.string().required(),
});

// Deanonymize
export const userDeanonymizeSchema = Joi.object({
  signInMethod: Joi.string()
    .allow('email-password')
    .allow('passwordless')
    .required(),
  email: emailRule.required(),
  password: passwordRule,
  connection: Joi.string().allow('email', 'sms'),
  defaultRole: Joi.string(),
  allowedRoles: Joi.array().items(Joi.string()),
});

// user provider tokens
export const userProviderTokensSchema = Joi.object({
  providerId: Joi.string().required(),
  userId: Joi.string().regex(uuidRegex),
});

export const emailTemplatesSchema = Joi.object({
  id: Joi.string().required(),
  locale: Joi.string().required(),
  subject: Joi.string(),
  html: Joi.string(),
  text: Joi.string(),
});

// -- TOKEN --

export const tokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// -----------

export const providerQuery = Joi.object({
  redirectUrl: Joi.string(),
});

export type ProviderQuery = {
  redirectUrl?: string;
};

export const providerCallbackQuery = Joi.object({
  state: Joi.string().uuid().required(),
}).unknown(true);

export type ProviderCallbackQuery = {
  state: string;
  [key: string]: any;
};
