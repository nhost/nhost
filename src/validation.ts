import { APPLICATION, REGISTRATION } from '@config/index'
import Joi from 'joi'
import compareUrls from 'compare-urls'

interface ExtendedStringSchema extends Joi.StringSchema {
  allowedDomains(): this
  allowedRedirectUrls(): this
}

interface ExtendedJoi extends Joi.Root {
  string(): ExtendedStringSchema
}

const extendedJoi: ExtendedJoi = Joi.extend((joi) => ({
  type: 'string',
  base: joi.string(),
  messages: {
    'string.allowedDomains': '{{#label}} is not in an authorised domain',
    'string.allowedRedirectUrls': '{{#label}} is not an authorised redirect url'
  },
  rules: {
    allowedDomains: {
      method(): unknown {
        return this.$_addRule({ name: 'allowedDomains' })
      },
      validate(value: string, helpers): unknown {
        if (REGISTRATION.ALLOWED_EMAIL_DOMAINS) {
          const lowerValue = value.toLowerCase()
          const allowedEmailDomains = REGISTRATION.ALLOWED_EMAIL_DOMAINS.split(',')

          if (allowedEmailDomains.every((domain) => !lowerValue.endsWith(domain.toLowerCase()))) {
            return helpers.error('string.allowedDomains')
          }
        }

        return value
      }
    },
    allowedRedirectUrls: {
      method(): unknown {
        return this.$_addRule({ name: 'allowedRedirectUrls' })
      },
      validate(value: string, helpers): unknown {
        if(APPLICATION.ALLOWED_REDIRECT_URLS.some(allowedUrl => compareUrls(value, allowedUrl))) {
          return value
        } else {
          return helpers.error('string.allowedRedirectUrls')
        }
      }
    }
  }
}))

const passwordRule = Joi.string().min(REGISTRATION.MIN_PASSWORD_LENGTH).max(128);
const passwordRuleRequired = passwordRule.required();

const emailRule = extendedJoi.string().email().required().allowedDomains()

const localeRule = Joi.string().length(2)
const localeRuleWithDefault = localeRule.default(APPLICATION.EMAILS_DEFAULT_LOCALE)

const accountFields = {
  email: emailRule,
  password: passwordRuleRequired,
  locale: localeRuleWithDefault
}

type AccountFields = {
  email: string
  password?: string
  locale: string
}

const accountFieldsMagicLink = {
  email: emailRule,
  locale: localeRuleWithDefault
}


type AccountFieldsMagicLink = {
  email: string
  locale: string
}

export const userDataFields = {
  user_data: Joi.object(
    REGISTRATION.CUSTOM_FIELDS.reduce<{ [k: string]: Joi.Schema[] }>(
      (aggr, key) => ({
        ...aggr,
        [key]: [
          Joi.string(),
          Joi.number(),
          Joi.boolean(),
          Joi.object(),
          Joi.array().items(Joi.string(), Joi.number(), Joi.boolean(), Joi.object())
        ]
      }),
      {}
    )
  ),
  register_options: Joi.object({
    allowed_roles: Joi.array().items(Joi.string()),
    default_role: Joi.string()
  })
}

export type UserDataFields = {
  user_data: any,
  register_options?: {
    allowed_roles?: string[],
    default_role?: string
  }
}

export const registerSchema = Joi.alternatives().try(
  // Regular register
  Joi.object({
    ...accountFields,
    ...userDataFields,
  }),
  // Magic link register
  Joi.object({
    ...accountFieldsMagicLink,
    ...userDataFields,
  })
)

export function isRegularRegister(body: RegisterSchema): body is RegularRegister {
  return body.email !== undefined && (body as RegularRegister).password !== undefined
}

export function isMagicLinkRegister(body: RegisterSchema): body is MagicLinkRegister {
  return body.email !== undefined && (body as RegularRegister).password === undefined
}

export type RegularRegister = AccountFields & UserDataFields

export type MagicLinkRegister = AccountFieldsMagicLink & UserDataFields

export type RegisterSchema = RegularRegister | MagicLinkRegister

export const deanonymizeSchema = Joi.object({
  email: emailRule,
  password: passwordRuleRequired
})

export type DeanonymizeSchema = {
  email: string,
  password: string
}

export const registerUserDataSchema = Joi.object(userDataFields)

export type RegisterUserDataSchema = UserDataFields

const ticketFields = {
  ticket: Joi.string().uuid({ version: 'uuidv4' }).required()
}

type TicketFields = {
  ticket: string
}

const codeFields = {
  code: Joi.string().length(6).required()
}

type CodeFields = {
  code: string
}

export const resetPasswordWithTicketSchema = Joi.object({
  ...ticketFields,
  new_password: passwordRule
})

export type ResetPasswordWithTicketSchema = TicketFields & {
  newPassword: string
}

export const changePasswordFromOldSchema = Joi.object({
  old_password: passwordRule,
  new_password: passwordRule
})

export type ChangePasswordFromOldSchema = {
  oldPassword: string
  newPassword: string
}

export const emailResetSchema = Joi.object({
  new_email: emailRule
})

export type EmailResetSchema = {
  new_email: string
}

export const logoutSchema = Joi.object({
  all: Joi.boolean()
})

export type LogoutSchema = {
  all?: boolean
}

export const mfaSchema = Joi.object(codeFields)

export type MfaSchema = CodeFields

export const loginSchema = Joi.alternatives().try(
  // Regular login
  Joi.object({
    email: emailRule,
    password: passwordRuleRequired,
    locale: localeRuleWithDefault
  }),
  // Magic link login
  Joi.object({
    email: emailRule,
    locale: localeRuleWithDefault
  }),
  // Anonymous login
  Joi.object({
    anonymous: Joi.boolean().invalid(false), // anonymous: true
    locale: localeRuleWithDefault
  }),
)

export function isRegularLogin(body: LoginSchema): body is RegularLogin {
  return (body as RegularLogin).email !== undefined && (body as RegularLogin).password !== undefined
}

export function isMagicLinkLogin(body: LoginSchema): body is MagicLinkLogin {
  return (body as RegularLogin).email !== undefined && (body as RegularLogin).password === undefined
}

export function isAnonymousLogin(body: LoginSchema): body is AnonymousLogin {
  return (body as AnonymousLogin).anonymous !== undefined
}

export type RegularLogin = {
  email: string
  password: string
  locale: string
}

export type MagicLinkLogin = {
  email: string
  locale: string
}

export type AnonymousLogin = {
  anonymous: true
  locale: string
}

export type LoginSchema = RegularLogin | MagicLinkLogin | AnonymousLogin

export const forgotSchema = Joi.object({ email: emailRule })

export type ForgotSchema = {
  email: string
}

export const verifySchema = Joi.object({ ...ticketFields })

export type VerifySchema = TicketFields

export const totpSchema = Joi.object({
  ...codeFields,
  ...ticketFields,
})

export type TotpSchema = CodeFields & TicketFields

export const magicLinkQuery = Joi.object({
  token: Joi.string().required(),
  action: Joi.string().valid('log-in', 'register').required(),
});

export type MagicLinkQuery = {
  token: string
  action: string
}

export const whitelistQuery = Joi.object({
  email: emailRule,
  invite: Joi.boolean().default(false),
  locale: localeRuleWithDefault
})

export type WhitelistQuery = {
  email: string
  invite: boolean
  locale: string
}

export const providerQuery = Joi.object({
  redirect_url_success: extendedJoi.string().allowedRedirectUrls().default(APPLICATION.REDIRECT_URL_SUCCESS),
  redirect_url_failure: extendedJoi.string().allowedRedirectUrls().default(APPLICATION.REDIRECT_URL_ERROR),
  jwt_token: Joi.string()
});

export type ProviderQuery = {
  redirect_url_success?: string
  redirect_url_failure?: string
  jwt_token?: string
}

export const providerCallbackQuery = Joi.object({
  state: Joi.string().uuid().required()
}).unknown(true)

export type ProviderCallbackQuery = {
  state: string
  [key: string]: any
}

export const localeQuery = Joi.object({
  locale: localeRuleWithDefault
})

export type LocaleQuery = {
  locale: string
}

export const resendConfirmationSchema = Joi.object({
  email: emailRule
})

export type ResendConfirmationSchema = {
  email: string
}
