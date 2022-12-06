import jwt_decode from 'jwt-decode'
import { computed } from 'vue'

import { JWTClaims } from '@nhost/hasura-auth-js'

import { useAccessToken } from './useAccessToken'

/**
 * Use the composable `useDecodedAccessToken` to get the decoded access token of the user.
 *
 * @example
 * ```tsx
 * const decodedAccessToken = useDecodedAccessToken()
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-decoded-access-token
 */
export const useDecodedAccessToken = () => {
  const jwt = useAccessToken()
  return computed(() => (jwt.value ? jwt_decode<JWTClaims>(jwt.value) : null))
}
