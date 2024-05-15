import { JWTClaims } from '@nhost/nhost-js'
import { jwtDecode } from 'jwt-decode'
import { computed, ComputedRef } from 'vue'
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
export const useDecodedAccessToken = (): ComputedRef<JWTClaims | null> => {
  const jwt = useAccessToken()
  return computed(() => (jwt.value ? jwtDecode<JWTClaims>(jwt.value) : null))
}
