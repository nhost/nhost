import { useMemo } from 'react'

import { SignUpOptions, User } from '@nhost/core'
import { useSelector } from '@xstate/react'

import { ActionHookState, useAuthenticationStatus, useAuthInterpreter } from './common'

type SignUpEmailPasswordHookState = ActionHookState & {
  needsEmailVerification: boolean
  user: User | null
  accessToken: string | null
}
type SignUpEmailPasswordHandlerResult = Omit<SignUpEmailPasswordHookState, 'isLoading'>

type SignUpEmailPasswordHandler = {
  (
    email: string,
    password: string,
    options?: SignUpOptions
  ): Promise<SignUpEmailPasswordHandlerResult>
  /** @deprecated */
  (
    email?: unknown,
    password?: string,
    options?: SignUpOptions
  ): Promise<SignUpEmailPasswordHandlerResult>
}

type SignUpEmailPasswordHookResult = {
  signUpEmailPassword: SignUpEmailPasswordHandler
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

  const signUpEmailPassword: SignUpEmailPasswordHandler = (
    valueEmail?: string | unknown,
    valuePassword = statePassword,
    valueOptions = stateOptions
  ) =>
    new Promise<SignUpEmailPasswordHandlerResult>((resolve) => {
      service.send({
        type: 'SIGNUP_EMAIL_PASSWORD',
        email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
        password: valuePassword,
        options: valueOptions
      })
      service.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'failed' } })) {
          resolve({
            accessToken: null,
            error: state.context.errors.registration || null,
            isError: true,
            isSuccess: false,
            needsEmailVerification: false,
            user: null
          })
        } else if (state.matches({ authentication: { signedOut: 'needsEmailVerification' } })) {
          resolve({
            accessToken: null,
            error: null,
            isError: false,
            isSuccess: false,
            needsEmailVerification: true,
            user: null
          })
        } else if (state.matches({ authentication: 'signedIn' })) {
          resolve({
            accessToken: state.context.accessToken.value,
            error: null,
            isError: false,
            isSuccess: true,
            needsEmailVerification: false,
            user: state.context.user
          })
        }
      })
    })

  const user = useSelector(
    service,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )
  const accessToken = useSelector(service, (state) => state.context.accessToken.value)

  return {
    accessToken,
    error,
    isError,
    isLoading,
    isSuccess,
    needsEmailVerification,
    signUpEmailPassword,
    user
  }
}
