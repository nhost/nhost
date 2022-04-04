import { useMemo } from 'react'

import { SignUpOptions } from '@nhost/core'
import { useSelector } from '@xstate/react'

import { ActionHookState, useAuthenticationStatus, useAuthInterpreter } from './common'

type SignUpEmailPasswordHookState = ActionHookState & {
  needsEmailVerification: boolean
}

type SignUpEmailPasswordHookHandler = {
  (email: string, password: string, options?: SignUpOptions): void
  /** @deprecated */
  (email?: unknown, password?: string, options?: SignUpOptions): void
}

type SignUpEmailPasswordHookResult = {
  signUpEmailPassword: SignUpEmailPasswordHookHandler
} & SignUpEmailPasswordHookState

type SignUpEmailPasswordHook = {
  (options?: SignUpOptions): SignUpEmailPasswordHookResult
  /** @deprecated */
  (email?: string, password?: string, options?: SignUpOptions): SignUpEmailPasswordHookResult
}
export const useSignUpEmailPassword: SignUpEmailPasswordHook = (
  a?: string | SignUpOptions,
  b?: string,
  c?: SignUpOptions
) => {
  const stateEmail: string | undefined = typeof a === 'string' ? a : undefined
  const statePassword: string | undefined = typeof b === 'string' ? b : undefined
  const stateOptions = c || (typeof a !== 'string' ? a : undefined)

  const service = useAuthInterpreter()
  const isError =
    !!service.status && service.state.matches({ authentication: { signedOut: 'failed' } })
  const error = useSelector(
    service,
    (state) => state.context.errors.registration || null,
    (a, b) => a?.error === b?.error
  )
  const { isLoading: loading, isAuthenticated: isSuccess } = useAuthenticationStatus()
  const isLoading = useMemo(() => loading && !isSuccess, [loading, isSuccess])
  const needsEmailVerification =
    !!service.status &&
    service.state.matches({ authentication: { signedOut: 'needsEmailVerification' } })

  const signUpEmailPassword: SignUpEmailPasswordHookHandler = (
    valueEmail,
    valuePassword = statePassword,
    valueOptions = stateOptions
  ) => {
    service.send({
      type: 'SIGNUP_EMAIL_PASSWORD',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      password: valuePassword,
      options: valueOptions
    })
  }

  return {
    signUpEmailPassword,
    isLoading,
    isSuccess,
    isError,
    error,
    needsEmailVerification
  }
}
