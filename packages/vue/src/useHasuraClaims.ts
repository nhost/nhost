import { JWTHasuraClaims } from '@nhost/nhost-js'
import { computed, ComputedRef } from 'vue'

import { useDecodedAccessToken } from './useDecodedAccessToken'

/**
 * Use the composable `useHasuraClaims` to get the Hasura claims of the user.
 *
 * @example
 * ```tsx
 * const hasuraClaims = useHasuraClaims()
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-hasura-claims
 */
export const useHasuraClaims = (): ComputedRef<JWTHasuraClaims | null> => {
  const claims = useDecodedAccessToken()
  return computed(() => claims.value?.['https://hasura.io/jwt/claims'] || null)
}
