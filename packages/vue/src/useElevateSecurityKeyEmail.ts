import {
  elevateEmailSecurityKeyPromise,
  ElevateWithSecurityKeyHandlerResult
} from '@nhost/nhost-js'
import { computed, unref } from 'vue'
import { RefOrValue } from './helpers'
import { useHasuraClaims } from './useHasuraClaims'
import { useNhostClient } from './useNhostClient'
import { useUserData } from './useUserData'

interface ElevateWithSecurityKeyHandler {
  (email: RefOrValue<string>): Promise<ElevateWithSecurityKeyHandlerResult>
}

interface ElevateWithSecurityKeyResult {
  elevateEmailSecurityKey: ElevateWithSecurityKeyHandler
  elevated: RefOrValue<boolean>
}

/**
 * Use the composable `useElevateSecurityKeyEmail` to elevate the user auth permission in order to perform sensitive operations
 *
 * @example
 * ```ts
 * const { elevateEmailSecurityKey, elevated } = useElevateSecurityKeyEmail()
 *
 * watchEffect(() => {
 *   console.log(elevated);
 * })
 *
 * await elevateEmailSecurityKey('joe@example.com')
 *
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-in-email-password
 */
export const useElevateSecurityKeyEmail = (): ElevateWithSecurityKeyResult => {
  const user = useUserData()
  const claims = useHasuraClaims()
  const { nhost } = useNhostClient()

  const hasElevatedClaim = computed(() =>
    user.value ? claims.value?.['x-hasura-auth-elevated'] === user.value?.id : false
  )

  const elevated = computed(() => !!hasElevatedClaim.value)

  const elevateEmailSecurityKey: ElevateWithSecurityKeyHandler = (email: RefOrValue<string>) =>
    elevateEmailSecurityKeyPromise(nhost.auth.client, unref(email))

  return {
    elevateEmailSecurityKey,
    elevated
  }
}
