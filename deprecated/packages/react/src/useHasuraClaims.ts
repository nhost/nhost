import { JWTHasuraClaims } from '@nhost/nhost-js'
import { useDecodedAccessToken } from './useDecodedAccessToken'

/**
 * Use the hook `useHasuraClaims` to get the Hasura claims of the user.
 *
 * @example
 * ```tsx
 * const hasuraClaims = useHasuraClaims()
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-hasura-claims
 */
export const useHasuraClaims = (): JWTHasuraClaims | null => {
  const claims = useDecodedAccessToken()
  return claims?.['https://hasura.io/jwt/claims'] || null
}
