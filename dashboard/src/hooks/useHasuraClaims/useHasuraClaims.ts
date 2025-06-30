import {
  useDecodedAccessToken,
  type JWTHasuraClaims,
} from '@/hooks/useDecodedAccessToken';

function useHasuraClaims(): JWTHasuraClaims | null {
  const decodedToken = useDecodedAccessToken();

  return decodedToken?.['https://hasura.io/jwt/claims'] || null;
}

export default useHasuraClaims;
