import { JWT } from 'jose';
import { Claims, Token, JwtSecret, PermissionVariables } from '@/types';
import { ENV } from '../env';

/**
 * Verify JWT token and return the Hasura claims.
 * @param authorization Authorization header.
 */
export const getClaims = (authorization: string | undefined): Claims => {
  if (!authorization) throw new Error('Missing Authorization header');
  const token = authorization.replace('Bearer ', '');
  try {
    const jwt: JwtSecret = JSON.parse(ENV.HASURA_GRAPHQL_JWT_SECRET);

    const decodedToken = JWT.verify(token, jwt.key) as Token;

    const jwtNameSpace = jwt.claims_namespace
      ? jwt.claims_namespace
      : 'https://hasura.io/jwt/claims';

    if (!decodedToken[jwtNameSpace]) {
      throw new Error('Claims namespace not found');
    }
    return decodedToken[jwtNameSpace];
  } catch (err) {
    throw new Error('Invalid or expired JWT token');
  }
};

export const getPermissionVariables = (
  authorization: string | undefined
): PermissionVariables => {
  const claims = getClaims(authorization);
  // * remove `x-hasura-` from claim props
  const claimsSanitized: Partial<PermissionVariables> = {};
  for (const claimKey in claims) {
    claimsSanitized[claimKey.replace('x-hasura-', '')] = claims[claimKey];
  }

  return claimsSanitized as PermissionVariables;
};
