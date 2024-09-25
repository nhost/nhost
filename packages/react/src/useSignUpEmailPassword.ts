import {
  signUpEmailPasswordPromise,
  SignUpEmailPasswordState,
  SignUpOptions,
  RequestOptions
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

type SignUpEmailPasswordHandlerResult = Omit<SignUpEmailPasswordState, 'isLoading'>

interface SignUpEmailPasswordHandler {
  (
    email: string,
    password: string,
    options?: SignUpOptions,
    requestOptions?: RequestOptions
  ): Promise<SignUpEmailPasswordHandlerResult>
}

export interface SignUpEmailPasswordHookResult extends SignUpEmailPasswordState {
  /** Used for a new user to sign up. Returns a promise with the current context */
  signUpEmailPassword: SignUpEmailPasswordHandler
}

interface SignUpEmailPasswordHook {
  (options?: SignUpOptions): SignUpEmailPasswordHookResult
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
export const useSignUpEmailPassword: SignUpEmailPasswordHook = (options) => {
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
    email,
    password,
    valueOptions = options,
    requestOptions
  ) => signUpEmailPasswordPromise(service, email, password as string, valueOptions, requestOptions)

  const user = useSelector(
    service,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )
  const accessToken = useSelector(service, (state) => state.context.accessToken.value)

  const refreshToken = useSelector(service, (state) => state.context.refreshToken.value)

  return {
    accessToken,
    refreshToken,
    error,
    isError,
    isLoading,
    isSuccess,
    needsEmailVerification,
    signUpEmailPassword,
    user
  }
}
