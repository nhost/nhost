import jwt_decode from 'jwt-decode'

import { JWTClaims } from '@nhost/hasura-auth-js'

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
export const useDecodedAccessToken = () => {
  const jwt = useAccessToken()
  return jwt ? jwt_decode<JWTClaims>(jwt) : null
}
