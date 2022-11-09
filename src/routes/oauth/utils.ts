import { NextFunction, Request, Response } from 'express';
import { GrantResponse } from 'grant';

import {
  locale as localeValidator,
  email as emailValidator,
} from '@/validation';
import { InsertUserMutationVariables } from '@/utils/__generated__/graphql-request';
import { ENV, getGravatarUrl } from '@/utils';
import { UserRegistrationOptions } from '@/types';
import { logger } from '@/logger';

import {
  PRE_REQUEST_PROVIDER_MIDDLEWARES,
  PROFILE_NORMALISERS,
} from './config';

/**
 * Fields that can be possibly returned by the OAuth provider and stored in the database
 */
export type NormalisedProfile = {
  id: string;
  displayName?: string;
  avatarUrl?: string;
  email: string;
  locale?: string;
  emailVerified?: boolean;
};

export const transformOauthProfile = async (
  normalised: NormalisedProfile,
  options?: Partial<UserRegistrationOptions>
): Promise<InsertUserMutationVariables['user']> => {
  // * Check if the email is valid. If not, throw an error
  const email = await emailValidator.validateAsync(normalised.email);

  // * Get the avatar URL from the normalised Oauth profile, and fallback to Gravatar if enabled
  const avatarUrl = normalised.avatarUrl || getGravatarUrl(email) || '';

  // * check if the locale is allowed, and if not, use the default one
  const locale =
    localeValidator.validate(options?.locale || normalised.locale).value ||
    ENV.AUTH_LOCALE_DEFAULT;

  /**
   * In order of priority:
   * 1. The value sent as an option by the user
   * 2. The value sent by the Oauth provider
   * 3. The email
   */
  const displayName = options?.displayName || normalised.displayName || email;

  // TODO not sure if this is the best way to do it: isn't profile.email always supposed to be here?
  // TODO and even so, do we allow unverified emails to be used?
  const emailVerified: boolean = normalised.emailVerified || !!email;

  return {
    passwordHash: null,
    metadata: options?.metadata || {},
    email,
    emailVerified,
    defaultRole: options?.defaultRole || ENV.AUTH_USER_DEFAULT_ROLE,
    roles: {
      data: (options?.allowedRoles || ENV.AUTH_USER_DEFAULT_ALLOWED_ROLES).map(
        (role) => ({
          role,
        })
      ),
    },
    locale,
    displayName,
    avatarUrl,
  };
};

export const normaliseProfile = async (
  provider: string,
  data: GrantResponse
) => {
  const normaliser =
    PROFILE_NORMALISERS[provider] || PROFILE_NORMALISERS.defaults;
  const profile = await normaliser(data);
  if (!profile.id) {
    logger.warn(`Missing id in profile for provider ${provider}`);
    logger.warn(data);
    throw new Error('Could not determine profile id');
  }
  return profile;
};

export const preRequestProviderMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const provider = req.params.provider;
  const middleware = PRE_REQUEST_PROVIDER_MIDDLEWARES[provider];
  if (middleware) {
    return middleware(req, res, next);
  }
  next();
};
