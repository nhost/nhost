import { unref } from 'vue'

import { useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useAuthenticated } from './useAuthenticated'
import { useAuthInterpreter } from './useAuthInterpreter'

export const useSignInEmailPassword = () => {
  const service = useAuthInterpreter()
  const signInEmailPassword = (email: RefOrValue<string>, password: RefOrValue<string>) =>
    service.value.send({
      type: 'SIGNIN_PASSWORD',
      email: unref(email),
      password: unref(password)
    })
  const sendMfaOtp = (otp: RefOrValue<string>) => {
    service.value.send({
      type: 'SIGNIN_MFA_TOTP',
      otp: unref(otp)
    })
  }
  const error = useSelector(
    service.value,
    (state) => state.context.errors.authentication,
    (a, b) => a?.error === b?.error
  )
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
    signInEmailPassword,
    isLoading,
    isSuccess,
    needsEmailVerification,
    needsMfaOtp,
    sendMfaOtp,
    isError,
    error
  }
}
