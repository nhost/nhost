import { JWTClaims } from '@nhost/nhost-js'
import { jwtDecode } from 'jwt-decode'
import { useAccessToken } from './useAccessToken'

/**
 * Use the hook `useDecodedAccessToken` to get the decoded access token of the user.
 *
 * @example
 * ```tsx
 * const decodedAccessToken = useDecodedAccessToken()
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-decoded-access-token
 */
export const useDecodedAccessToken = (): JWTClaims | null => {
  const jwt = useAccessToken()
  return jwt ? jwtDecode<JWTClaims>(jwt) : null
}
