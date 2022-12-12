import {
  signUpEmailPasswordPromise,
  SignUpEmailPasswordState,
  SignUpOptions
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

type SignUpEmailPasswordHandlerResult = Omit<SignUpEmailPasswordState, 'isLoading'>

interface SignUpEmailPasswordHandler {
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

export interface SignUpEmailPasswordHookResult extends SignUpEmailPasswordState {
  /** Used for a new user to sign up. Returns a promise with the current context */
  signUpEmailPassword: SignUpEmailPasswordHandler
}

interface SignUpEmailPasswordHook {
  (options?: SignUpOptions): SignUpEmailPasswordHookResult
  /** @deprecated */
  (email?: string, password?: string, options?: SignUpOptions): SignUpEmailPasswordHookResult
}

/**
 * Use the hook `useSignUpEmailPassword` to sign up a user using email and password.
 *
 * @example
 * ```tsx
 * const { signUpEmailPassword, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignUpEmailPassword()
 *
 * console.log({ needsEmailVerification, isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signUpEmailPassword('joe@example.com','secret-password')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-up-email-password
 */
export const useSignUpEmailPassword: SignUpEmailPasswordHook = (
  a?: string | SignUpOptions,
  b?: string,
  c?: SignUpOptions
) => {
  const stateEmail: string | undefined = typeof a === 'string' ? a : undefined
  const statePassword: string | undefined = typeof b === 'string' ? b : undefined
  const stateOptions = c || (typeof a !== 'string' ? a : undefined)

  const service = useAuthInterpreter()
  const isError = useSelector(service, (state) => !!state.context.errors.registration)

  const error = useSelector(
    service,
    (state) => state.context.errors.registration || null,
    (a, b) => a?.error === b?.error
  )

  const isLoading = useSelector(service, (state) => state.matches('registration.emailPassword'))

  const needsEmailVerification = useSelector(service, (state) =>
    state.matches('registration.incomplete.needsEmailVerification')
  )

  const isSuccess = useSelector(service, (state) =>
    state.matches({
      authentication: 'signedIn',
      registration: 'complete'
    })
  )

  const signUpEmailPassword: SignUpEmailPasswordHandler = (
    valueEmail?: string | unknown,
    valuePassword = statePassword,
    valueOptions = stateOptions
  ) =>
    signUpEmailPasswordPromise(
      service,
      typeof valueEmail === 'string' ? valueEmail : (stateEmail as string),
      valuePassword as string,
      valueOptions
    )

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
