import { jwtDecode } from 'jwt-decode';
import { useAccessToken } from '@/hooks/useAccessToken';

export interface JWTClaims {
  sub?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  'https://hasura.io/jwt/claims': JWTHasuraClaims;
}

export interface JWTHasuraClaims {
  // ? does not work as expected: if the key does not start with `x-hasura-`, then it is typed as `any`
  // [claim: `x-hasura-${string}`]: string | string[]
  [claim: string]: string | string[] | null;
  'x-hasura-allowed-roles': string[];
  'x-hasura-default-role': string;
  'x-hasura-user-id': string;
  'x-hasura-user-is-anonymous': string;
  'x-hasura-auth-elevated': string;
}

function useDecodedAccessToken() {
  const token = useAccessToken();
  return token ? jwtDecode<JWTClaims>(token) : null;
}

export default useDecodedAccessToken;
