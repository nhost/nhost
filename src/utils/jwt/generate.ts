import { JWTPayload, SignJWT } from 'jose';
import { ClaimValueType } from '@/types';
import { UserFieldsFragment } from '../__generated__/graphql-request';
import { ENV } from '../env';
import { generateCustomClaims } from './custom-claims';
import { createSecretKey } from 'crypto';

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
  const { key, type, issuer } = ENV.HASURA_GRAPHQL_JWT_SECRET;
  const secret = createSecretKey(key, 'utf-8');
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
