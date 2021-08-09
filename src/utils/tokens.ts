import { JWT } from 'jose';
import { v4 as uuidv4 } from 'uuid';

import { TOKEN } from '@config/index';
import { gqlSdk } from '@/utils/gqlSDK';
import { Claims, Token, ClaimValueType, PermissionVariables } from '../types';
import { UserFieldsFragment } from './__generated__/graphql-request';
import { generateTicketExpiresAt } from './ticket';
import { getProfileFieldsForAccessToken } from './profile';
import { ENV } from './env';

// const RSA_TYPES = ["RS256", "RS384", "RS512"];
const SHA_TYPES = ['HS256', 'HS384', 'HS512'];

if (!SHA_TYPES.includes(TOKEN.ALGORITHM)) {
  throw new Error(`Invalid JWT algorithm: ${TOKEN.ALGORITHM}`);
}

if (!TOKEN.JWT_SECRET) {
  throw new Error('Empty JWT secret key');
}

/**
 * Convert array to Postgres array
 * @param arr js array to be converted to Postgres array
 */
function toPgArray(arr: string[]): string {
  const m = arr.map((e) => `"${e}"`).join(',');
  return `{${m}}`;
}

/**
 * Create an object that contains all the permission variables of the user,
 * i.e. user-id, allowed-roles, default-role and the kebab-cased columns
 * of the public.tables columns defined in JWT_CUSTOM_FIELDS
 * @param jwt if true, add a 'x-hasura-' prefix to the property names, and stringifies the values (required by Hasura)
 */
export function generatePermissionVariables(
  user: UserFieldsFragment,
  profile: any
): {
  [key: string]: ClaimValueType;
} {
  const allowedRoles = user.roles.map((role) => role.role);

  // add user's default role to allowed roles
  if (!allowedRoles.includes(user.defaultRole)) {
    allowedRoles.push(user.defaultRole);
  }

  // custom user session variables
  const customUserSessionVariables = {} as any;
  ENV.USER_SESSION_VARIABLE_FIELDS.forEach((field) => {
    if (!(field in user)) {
      throw new Error('field not in user');
    }

    // make user any type
    const userAny = user as any;

    // value to set for the session variable
    let value;

    const type = typeof userAny[field] as ClaimValueType;

    if (type === 'string') {
      value = userAny[field];
    } else if (Array.isArray(userAny[field])) {
      value = toPgArray(userAny[field] as string[]);
    } else {
      value = JSON.stringify(userAny[field] ?? null);
    }

    // we've made sure `field` is part of `user` in the check above
    customUserSessionVariables[`x-hasura-user-${field}`] = value;
  });

  // profile
  const customProfileSessionVariables = {} as any;
  ENV.PROFILE_SESSION_VARIABLE_FIELDS.forEach((field) => {
    let value;

    const type = typeof profile[field] as ClaimValueType;
    if (type === 'string') {
      value = profile[field];
    } else if (Array.isArray(profile[field])) {
      value = toPgArray(profile[field] as string[]);
    } else {
      value = JSON.stringify(profile[field] ?? null);
    }

    customProfileSessionVariables[`x-hasura-profile-${field}`] = value;
  });

  return {
    [`x-hasura-allowed-roles`]: allowedRoles,
    [`x-hasura-default-role`]: user.defaultRole,
    [`x-hasura-user-id`]: user.id,
    [`x-hasura-user-isAnonymous`]: user.isAnonymous.toString(),
    ...customProfileSessionVariables,
    ...customUserSessionVariables,
  };
}

/**
 * * Signs a payload with the existing JWT configuration
 */
export const sign = ({
  payload,
  user,
}: {
  payload: object;
  user: UserFieldsFragment;
}) => {
  return JWT.sign(payload, TOKEN.JWT_SECRET, {
    algorithm: TOKEN.ALGORITHM,
    expiresIn: `${TOKEN.ACCESS_TOKEN_EXPIRES_IN}s`,
    subject: user.id,
    issuer: 'nhost',
  });
};

/**
 * Verify JWT token and return the Hasura claims.
 * @param authorization Authorization header.
 */
export const getClaims = (authorization: string | undefined): Claims => {
  if (!authorization) throw new Error('Missing Authorization header');
  const token = authorization.replace('Bearer ', '');
  try {
    const decodedToken = JWT.verify(token, TOKEN.JWT_SECRET) as Token;
    if (!decodedToken[TOKEN.CLAIMS_NAMESPACE])
      throw new Error('Claims namespace not found');
    return decodedToken[TOKEN.CLAIMS_NAMESPACE];
  } catch (err) {
    throw new Error('Invalid or expired JWT token');
  }
};

export const getPermissionVariablesFromClaims = (
  claims: Claims
): PermissionVariables => {
  // remove `x-hasura-` from claim props
  const claimsSanitized: { [k: string]: any } = {};
  for (const claimKey in claims) {
    claimsSanitized[claimKey.replace('x-hasura-', '') as string] =
      claims[claimKey];
  }

  return claimsSanitized as PermissionVariables;
};

export function newRefreshExpiry() {
  const date = new Date();

  // cant return this becuase this will return a unix timestamp directly
  date.setSeconds(date.getSeconds() + TOKEN.REFRESH_TOKEN_EXPIRES_IN);

  // instead we must return the js date object
  return date;
}

/**
 * Create JWT token.
 */
export const createHasuraAccessToken = (
  user: UserFieldsFragment,
  profile: unknown
): string => {
  return sign({
    payload: {
      [TOKEN.CLAIMS_NAMESPACE]: generatePermissionVariables(user, profile),
    },
    user,
  });
};

export const getNewRefreshToken = async (
  userId: string,
  refreshToken = uuidv4()
) => {
  await gqlSdk.insertRefreshToken({
    refreshToken: {
      userId,
      refreshToken,
      expiresAt: new Date(newRefreshExpiry()),
    },
  });

  return refreshToken;
};

export type SignInTokens = {
  accessToken: string | null;
  accessTokenExpiresIn: number | null;
  refreshToken: string | null;
  mfa: null | {
    enabled: boolean;
    ticket: string;
  };
};

export const getSignInTokens = async ({
  userId,
  checkMFA,
}: {
  userId: string;
  checkMFA: boolean;
}): Promise<SignInTokens> => {
  const { user } = await gqlSdk.user({
    id: userId,
  });

  if (!user) {
    throw new Error('No user');
  }

  if (checkMFA && user?.activeMfaType === 'totp') {
    // generate new ticket
    const ticket = `mfaTotp:${uuidv4()}`;

    // set ticket
    await gqlSdk.updateUser({
      id: userId,
      user: {
        ticket,
        ticketExpiresAt: generateTicketExpiresAt(5 * 60),
      },
    });

    return {
      accessToken: null,
      accessTokenExpiresIn: null,
      refreshToken: null,
      mfa: {
        enabled: true,
        ticket,
      },
    };
  }

  const profile = await getProfileFieldsForAccessToken({
    userId: user.id,
  }).catch(() => {
    // noop
    // profile is not available
  });

  const accessToken = createHasuraAccessToken(user, profile);
  const refreshToken = await getNewRefreshToken(userId);

  return {
    accessToken,
    accessTokenExpiresIn: TOKEN.ACCESS_TOKEN_EXPIRES_IN,
    refreshToken,
    mfa: null,
  };
};

type Tokens = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
};

export const getNewTokens = async ({
  user,
}: {
  user: UserFieldsFragment;
}): Promise<Tokens> => {
  const profile = await getProfileFieldsForAccessToken({
    userId: user.id,
  }).catch(() => {
    // noop
    // profile is not available
  });

  const accessToken = createHasuraAccessToken(user, profile);
  const refreshToken = await getNewRefreshToken(user.id);

  return {
    accessToken,
    accessTokenExpiresIn: TOKEN.ACCESS_TOKEN_EXPIRES_IN,
    refreshToken,
  };
};
