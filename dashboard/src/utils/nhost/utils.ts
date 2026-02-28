import { jwtDecode } from 'jwt-decode';
import type { JWTClaims } from '@/hooks/useDecodedAccessToken';
import nhost from './nhost';

export function getHasuraClaims() {
  const session = nhost.getUserSession();

  return session?.accessToken
    ? jwtDecode<JWTClaims>(session.accessToken)
    : null;
}
