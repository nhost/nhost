import {
  elevateEmailSecurityKeyPromise,
  ElevateWithSecurityKeyHandlerResult
} from '@nhost/nhost-js'
import { useEffect, useState } from 'react'
import { useHasuraClaims } from './useHasuraClaims'
import { useNhostClient } from './useNhostClient'
import { useUserData } from './useUserData'

interface ElevateWithSecurityKeyHandler {
  (email: string): Promise<ElevateWithSecurityKeyHandlerResult>
}

interface ElevateWithSecurityKeyHook {
  elevateEmailSecurityKey: ElevateWithSecurityKeyHandler
  elevated: boolean
}

/**
 * Use the hook `useElevateSecurityKeyEmail` to elevate the user auth permission in order to perform sensitive operations
 *
 * @example
 * ```tsx
 * const { elevateEmailSecurityKey, elevated } = useElevateSecurityKeyEmail()
 *
 * console.log({ elevated });
 *
 * await elevateEmailSecurityKey('joe@example.com')
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/elevate-web-authn
 */
export const useElevateSecurityKeyEmail = (): ElevateWithSecurityKeyHook => {
  const user = useUserData()
  const nhost = useNhostClient()
  const claims = useHasuraClaims()

  const [elevated, setElevated] = useState(claims?.['x-hasura-auth-elevated'] === user?.id)

  const elevateEmailSecurityKey: ElevateWithSecurityKeyHandler = (email: string) =>
    elevateEmailSecurityKeyPromise(nhost.auth.client, email)

  useEffect(() => {
    setElevated(claims?.['x-hasura-auth-elevated'] === user?.id)
  }, [claims, user])

  return {
    elevated,
    elevateEmailSecurityKey
  }
}
