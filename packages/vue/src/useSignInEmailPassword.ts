import { ToRefs, unref } from 'vue'

import { User } from '@nhost/core'
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

type SignInEmailPasswordHandlerResult = Omit<SignInEmailPasswordComposableState, 'isLoading'>
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
    new Promise<SignInEmailPasswordHandlerResult>((resolve) => {
      service.value.send('SIGNIN_PASSWORD', {
        email: unref(email),
        password: unref(password)
      })
      service.value.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'needsEmailVerification' } })) {
          resolve({
            accessToken: null,
            error: null,
            isError: false,
            isSuccess: false,
            needsEmailVerification: true,
            needsMfaOtp: false,
            user: null
          })
        } else if (state.matches({ authentication: { signedOut: 'needsMfa' } })) {
          resolve({
            accessToken: null,
            error: null,
            isError: false,
            isSuccess: false,
            needsEmailVerification: false,
            needsMfaOtp: true,
            user: null
          })
        } else if (state.matches({ authentication: { signedOut: 'failed' } })) {
          resolve({
            accessToken: null,
            error: state.context.errors.authentication || null,
            isError: true,
            isSuccess: false,
            needsEmailVerification: false,
            needsMfaOtp: false,
            user: null
          })
        } else if (state.matches({ authentication: 'signedIn' })) {
          resolve({
            accessToken: state.context.accessToken.value,
            error: null,
            isError: false,
            isSuccess: true,
            needsEmailVerification: false,
            needsMfaOtp: false,
            user: state.context.user
          })
        }
      })
    })
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
    (state) => state.matches({ authentication: { signedOut: 'needsEmailVerification' } }),
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
