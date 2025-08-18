import { computed, ComputedRef, unref } from 'vue'

import { RefOrValue } from './helpers'
import { useHasuraClaims } from './useHasuraClaims'

/**
 * Use the composable `useHasuraClaim` to get the value of a specific Hasura claim of the user.
 *
 * @example
 * ```tsx
 * // if `x-hasura-company-id` exists as a custom claim
 * const companyId = useHasuraClaim('company-id')
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-hasura-claim
 */
export const useHasuraClaim = (name: RefOrValue<string>): ComputedRef<string | string[] | null> => {
  const hasuraClaims = useHasuraClaims()
  return computed(() => {
    const unrefName = unref(name)
    return (
      hasuraClaims.value?.[
        unrefName.startsWith('x-hasura-') ? unrefName : `x-hasura-${unrefName}`
      ] || null
    )
  })
}
