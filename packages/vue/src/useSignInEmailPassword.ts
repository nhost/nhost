import { ToRefs, unref } from 'vue'

import { User, signInEmailPasswordPromise, SignInEmailPasswordHandlerResult } from '@nhost/core'
import { useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { DefaultActionComposableState } from './types'
import { useAuthenticated } from './useAuthenticated'
import { useAuthInterpreter } from './useAuthInterpreter'
import { useError } from './useError'

interface SignInEmailPasswordComposableState extends DefaultActionComposableState {
  needsMfaOtp: boolean
  needsEmailVerification: boolean
  user: User | null
  accessToken: string | null
}
interface SignInEmailPasswordComposableResult extends ToRefs<SignInEmailPasswordComposableState> {
  signInEmailPassword(
    email: RefOrValue<string>,
    password: RefOrValue<string>
  ): Promise<SignInEmailPasswordHandlerResult>
  sendMfaOtp(otp: RefOrValue<string>): void
}

/**
 * Email and Password Sign-In
 */
export const useSignInEmailPassword = (): SignInEmailPasswordComposableResult => {
  const service = useAuthInterpreter()
  const signInEmailPassword = (email: RefOrValue<string>, password: RefOrValue<string>) =>
    signInEmailPasswordPromise(service.value, unref(email), unref(password))

  const sendMfaOtp = (otp: RefOrValue<string>) => {
    service.value.send('SIGNIN_MFA_TOTP', {
      otp: unref(otp)
    })
  }

  const user = useSelector(
    service.value,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )

  const accessToken = useSelector(service.value, (state) => state.context.accessToken.value)

  const error = useError('authentication')

  const isSuccess = useAuthenticated()

  const isLoading = useSelector(
    service.value,
    (state) => state.matches({ authentication: { authenticating: 'password' } }),
    (a, b) => a === b
  )

  const needsEmailVerification = useSelector(
    service.value,
    (state) =>
      state.matches({ authentication: { signedOut: 'noErrors' }, email: 'awaitingVerification' }),
    (a, b) => a === b
  )

  const needsMfaOtp = useSelector(
    service.value,
    (state) => state.matches({ authentication: { signedOut: 'needsMfa' } }),
    (a, b) => a === b
  )

  const isError = useSelector(
    service.value,
    (state) => state.matches({ authentication: { signedOut: 'failed' } }),
    (a, b) => a === b
  )

  return {
    accessToken,
    error,
    isError,
    isLoading,
    isSuccess,
    needsEmailVerification,
    needsMfaOtp,
    sendMfaOtp,
    signInEmailPassword,
    user
  }
}
