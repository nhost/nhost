import { JWTPayload, SignJWT, importPKCS8, KeyLike } from 'jose';
import { ClaimValueType } from '@/types';
import { UserFieldsFragment } from '../__generated__/graphql-request';
import { ENV } from '../env';
import { generateCustomClaims } from './custom-claims';
import { createSecretKey } from 'crypto';

export const getSecret = async (): Promise<KeyLike> => {
  const { key, signing_key, type } = ENV.HASURA_GRAPHQL_JWT_SECRET;

  let secret: KeyLike;
  if (type.startsWith('HS')) {
    // For HMAC algorithms (HS256, HS384, HS512)
    secret = createSecretKey(key, 'utf-8');
  } else if (type.startsWith('RS')) {
    // For RSA algorithms (RS256, RS384, RS512)
    // The key should be in PEM format
    if (!signing_key) {
      throw new Error('RSA Private key not provided');
    }

    secret = await importPKCS8(signing_key, type);
  } else {
    throw new Error(`Unsupported algorithm type: ${type}`);
  }

  return secret;
}


/**
 * * Signs a payload with the existing JWT configuration
 */
export const sign = async ({
  payload,
  user,
}: {
  payload: JWTPayload;
  user: UserFieldsFragment;
}) => {
  const { type, issuer } = ENV.HASURA_GRAPHQL_JWT_SECRET;

  const secret = await getSecret();

  return new SignJWT(payload)
    .setProtectedHeader({ alg: type })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ENV.AUTH_ACCESS_TOKEN_EXPIRES_IN}s`)
    .setIssuer(issuer || 'hasura-auth')
    .sign(secret);
};

/**
 * Create an object that contains all the permission variables of the user,
 * i.e. user-id, allowed-roles, default-role and the kebab-cased columns
 * of the public.tables columns defined in JWT_CUSTOM_FIELDS
 * @param jwt if true, add a 'x-hasura-' prefix to the property names, and stringifies the values (required by Hasura)
 */
const generateHasuraClaims = async (
  user: UserFieldsFragment,
  extraClaims?: { [key: string]: ClaimValueType },
): Promise<{
  [key: string]: ClaimValueType;
}> => {
  const allowedRoles = user.roles.map((role) => role.role);

  // add user's default role to allowed roles
  if (!allowedRoles.includes(user.defaultRole)) {
    allowedRoles.push(user.defaultRole);
  }

  const customClaims = await generateCustomClaims(user.id);
  return {
    ...customClaims,
    ...extraClaims,
    [`x-hasura-allowed-roles`]: allowedRoles,
    [`x-hasura-default-role`]: user.defaultRole,
    [`x-hasura-user-id`]: user.id,
    [`x-hasura-user-is-anonymous`]: user.isAnonymous.toString(),
  };
};
/**
 * Create JWT ENV.
 */
export const createHasuraAccessToken = async (
  user: UserFieldsFragment,
  extraClaims?: { [key: string]: ClaimValueType },
): Promise<string> => {
  const namespace =
    ENV.HASURA_GRAPHQL_JWT_SECRET.claims_namespace ||
    'https://hasura.io/jwt/claims';

  return sign({
    payload: {
      [namespace]: await generateHasuraClaims(user, extraClaims),
    },
    user,
  });
};
