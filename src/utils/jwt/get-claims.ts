import { Claims, PermissionVariables, Token } from '@/types';
import { jwtVerify } from 'jose';
import { ENV } from '../env';
import { getSecret } from './generate';

const ALLOWED_JWT_TYPES = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'];

if (!ALLOWED_JWT_TYPES.includes(ENV.HASURA_GRAPHQL_JWT_SECRET.type)) {
  throw new Error(`Invalid JWT type: ${ENV.HASURA_GRAPHQL_JWT_SECRET.type}`);
}

if (!ENV.HASURA_GRAPHQL_JWT_SECRET.key) {
  throw new Error('Empty JWT key');
}

export const verifyJwt = async (jwt: string) => {
  const secret = await getSecret();
  const result = await jwtVerify(jwt, secret);
  return result.payload as unknown as Token;
};

/**
 * Verify JWT token and return the Hasura claims.
 * @param authorization Authorization header.
 */
export const getClaims = async (
  authorization: string | undefined
): Promise<Claims> => {
  if (!authorization) throw new Error('Missing Authorization header');
  const token = authorization.replace('Bearer ', '');
  try {
    const decodedToken = await verifyJwt(token);

    const namespace =
      ENV.HASURA_GRAPHQL_JWT_SECRET.claims_namespace ||
      'https://hasura.io/jwt/claims';

    if (!decodedToken[namespace]) {
      throw new Error('Claims namespace not found');
    }
    return decodedToken[namespace];
  } catch (err) {
    throw new Error('Invalid or expired JWT token');
  }
};

export const getPermissionVariables = async (
  authorization: string | undefined
): Promise<PermissionVariables> => {
  const claims = await getClaims(authorization);
  // * remove `x-hasura-` from claim props
  const claimsSanitized: Partial<PermissionVariables> = {};
  for (const claimKey in claims) {
    claimsSanitized[claimKey.replace('x-hasura-', '')] = claims[claimKey];
  }

  return claimsSanitized as PermissionVariables;
};
