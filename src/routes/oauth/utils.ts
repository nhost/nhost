import { NextFunction, Request, Response } from 'express';
import { GrantConfig, GrantResponse } from 'grant';

import { castBooleanEnv, castStringArrayEnv } from '@config';
import {
  locale as localeValidator,
  email as emailValidator,
} from '@/validation';
import { InsertUserMutationVariables } from '@/utils/__generated__/graphql-request';
import { ENV, getGravatarUrl } from '@/utils';
import { UserRegistrationOptions } from '@/types';

import { OAUTH_ROUTE, PROVIDERS_CONFIG } from './config';

/**
 * Fields that can be possibly returned by the OAuth provider and stored in the database
 */
export type NormalisedProfile = Partial<{
  id: string;
  displayName: string;
  avatarUrl: string;
  email: string;
  locale: string;
  emailVerified: boolean;
}>;

/**
 * Transform the profile normalised from the provider to the format we store in the database.
 * - Options sent by the client (locale, displayName) take precedence over the profile returned by the provider.
 * - Fall back to the email as the display name
 * - the locale should be in the list of allowed locales, and if not, fall back to the default locale
 */
export const transformOauthProfile = async (
  normalised: NormalisedProfile,
  options?: Partial<UserRegistrationOptions>
): Promise<InsertUserMutationVariables['user']> => {
  // * Check if the email is valid. If not, throw an error
  const email = await emailValidator.validateAsync(normalised.email);

  // * Get the avatar URL from the normalised Oauth profile, and fallback to Gravatar if enabled
  const avatarUrl = normalised.avatarUrl || getGravatarUrl(email) || '';

  // * check if the locale is allowed, and if not, use the default one
  let locale = ENV.AUTH_LOCALE_DEFAULT;
  const customLocale = localeValidator.validate(
    options?.locale || normalised.locale
  );
  if (!customLocale.error) {
    locale = customLocale.value;
  }

  /**
   * In order of priority:
   * 1. The value sent as an option by the user
   * 2. The value sent by the Oauth provider
   * 3. The email
   */
  const displayName = options?.displayName || normalised.displayName || email;

  const emailVerified = !!normalised.emailVerified;

  let allowedRoles: string[] = ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES;

  if (options?.allowedRoles) {
    if (Array.isArray(options.allowedRoles)) {
      allowedRoles = options.allowedRoles;
    } else if (typeof options.allowedRoles === 'string') {
      //if for some reason it comes as a string, split it
      allowedRoles = (options.allowedRoles as string).split(',');
    }
  }

  return {
    passwordHash: null,
    metadata: options?.metadata || {},
    email,
    emailVerified,
    defaultRole: options?.defaultRole || ENV.AUTH_USER_DEFAULT_ROLE,
    roles: {
      data: allowedRoles.map((role) => ({
        role,
      })),
    },
    locale,
    displayName,
    avatarUrl,
  };
};

export const normaliseProfile = (provider: string, data: GrantResponse) =>
  PROVIDERS_CONFIG[provider].profile(data);

export const preRequestProviderMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const provider = req.params.provider;
  const middleware = PROVIDERS_CONFIG[provider]?.middleware;
  if (middleware) {
    return middleware(req, res, next);
  }
  next();
};

/**
 * Create Grant standard configuration
 * - Sets the Grant defauls
 * - Enables the providers defined in the env variables
 * - Adds the custom scope defined in the env variables
 */
export const createGrantConfig = (): GrantConfig =>
  Object.keys(PROVIDERS_CONFIG).reduce<GrantConfig>(
    (aggr, provider) => {
      // * Convert the provider name used in Grant into its name in the env variables
      let providerEnvName = provider.toUpperCase();
      if (providerEnvName === 'WINDOWSLIVE') {
        providerEnvName = 'WINDOWS_LIVE';
      }
      if (castBooleanEnv(`AUTH_PROVIDER_${providerEnvName}_ENABLED`)) {
        const grant = { ...PROVIDERS_CONFIG[provider].grant };
        const customScope = castStringArrayEnv(
          `AUTH_PROVIDER_${providerEnvName}_SCOPE`
        );
        if (customScope.length) {
          // * Adds the scope defined in the env variables to the scope sent as a parameter
          const initialScope = Array.isArray(grant.scope)
            ? grant.scope
            : typeof grant.scope === 'string'
            ? [grant.scope]
            : [];
          // * Merge both sources, and remove duplicates
          grant.scope = [...new Set([...initialScope, ...customScope])];
        }
        aggr[provider] = grant;
      }
      return aggr;
    },
    {
      defaults: {
        origin: ENV.AUTH_SERVER_URL,
        prefix: `${ENV.AUTH_API_PREFIX}${OAUTH_ROUTE}`,
        transport: 'session',
        scope: ['email', 'profile'],
        response: ['tokens', 'email', 'profile', 'jwt'],
      },
    }
  );
