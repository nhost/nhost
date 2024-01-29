import {
  elevateEmailSecurityKeyPromise,
  ElevateWithSecurityKeyHandlerResult,
  SignInSecurityKeyPasswordlessState
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

interface ElevateWithSecurityKeyHandler {
  (email: string): Promise<ElevateWithSecurityKeyHandlerResult>
}

export interface ElevateWithSecurityKeyHookResult
  extends Omit<SignInSecurityKeyPasswordlessState, 'needsEmailVerification'> {
  elevateEmailSecurityKey: ElevateWithSecurityKeyHandler
}

interface ElevateWithSecurityKeyHook {
  (): ElevateWithSecurityKeyHookResult
}

/**
 * Use the hook `useElevateSecurityKeyEmail` to elevate the user auth permission in order to perform sensitive operations
 *
 * @example
 * ```tsx
 * const { elevateEmailSecurityKey, isLoading, isSuccess, isError, error } = useSignInEmailSecurityKey()
 *
 * console.log({ elevateEmailSecurityKey, isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await elevateEmailSecurityKey('joe@example.com')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/elevate-web-authn
 */
export const useElevateSecurityKeyEmail: ElevateWithSecurityKeyHook = () => {
  const service = useAuthInterpreter()

  const elevateEmailSecurityKey: ElevateWithSecurityKeyHandler = (email: string) =>
    elevateEmailSecurityKeyPromise(service, email)

  const user = useSelector(
    service,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )

  const accessToken = useSelector(service, (state) => state.context.accessToken.value)

  const refreshToken = useSelector(service, (state) => state.context.refreshToken.value)

  const error = useSelector(
    service,
    (state) => state.context.errors.authentication || null,
    (a, b) => a?.error === b?.error
  )

  const isSuccess = useSelector(service, (state) =>
    state.matches({
      authentication: { elevated: 'success' }
    })
  )

  const isLoading = useSelector(
    service,
    (state) => state.matches({ authentication: { authenticating: 'elevateSecurityKeyEmail' } }),
    (a, b) => a === b
  )

  const isError = useSelector(
    service,
    (state) => state.matches({ authentication: { elevated: 'failed' } }),
    (a, b) => a === b
  )

  const elevated = useSelector(service, (state) => state.context.elevated)

  return {
    accessToken,
    refreshToken,
    error,
    isError,
    isLoading,
    isSuccess,
    user,
    elevateEmailSecurityKey,
    elevated
  }
}
