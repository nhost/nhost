import { computed, ToRefs, unref } from 'vue'

import { SignUpOptions, User } from '@nhost/core'
import { useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { DefaultActionComposableState } from './types'
import { useAccessToken } from './useAccessToken'
import { useAuthenticationStatus } from './useAuthenticationStatus'
import { useAuthInterpreter } from './useAuthInterpreter'
import { useError } from './useError'
import { useUserData } from './useUserData'

interface SignUpEmailPasswordComposableState extends DefaultActionComposableState {
  /** @return `true` if an email is required to complete the action, and that a verificaiton email has been sent to complete the action. */
  needsEmailVerification: boolean
  /** User information */
  user: User | null
  /** Access token (JWT) */
  accessToken: string | null
}

type SignUpEmailPasswordHandlerResult = Omit<SignUpEmailPasswordComposableState, 'isLoading'>
interface SignUpEmailPasswordComposableResult extends ToRefs<SignUpEmailPasswordComposableState> {
  /** Used for a new user to sign up. Returns a promise with the current context */
  signUpEmailPassword(
    email: RefOrValue<string>,
    password: RefOrValue<string>
  ): Promise<SignUpEmailPasswordHandlerResult>
}

/**
 * Email and Password Sign-Up
 * @example
```js
const {
  isError,
  isLoading,
  isSuccess,
  needsEmailVerification,
  signUpEmailPassword
} = useSignUpEmailPassword();
```
 */
export const useSignUpEmailPassword = (
  options?: RefOrValue<SignUpOptions>
): SignUpEmailPasswordComposableResult => {
  const service = useAuthInterpreter()
  const isError = useSelector(service.value, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )

  const error = useError('registration')

  const { isLoading: loading, isAuthenticated: isSuccess } = useAuthenticationStatus()

  const isLoading = computed(() => loading.value && !isSuccess.value)
  const needsEmailVerification = useSelector(service.value, (state) =>
    state.matches({ authentication: { signedOut: 'noErrors' }, email: 'awaitingVerification' })
  )
  const accessToken = useAccessToken()
  const user = useUserData()
  const signUpEmailPassword = (email: RefOrValue<string>, password: RefOrValue<string>) =>
    new Promise<SignUpEmailPasswordHandlerResult>((resolve) => {
      service.value.send('SIGNUP_EMAIL_PASSWORD', {
        email: unref(email),
        password: unref(password),
        options: unref(options)
      })
      service.value.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'failed' } })) {
          resolve({
            accessToken: null,
            error: state.context.errors.registration || null,
            isError: true,
            isSuccess: false,
            needsEmailVerification: false,
            user: null
          })
        } else if (
          state.matches({
            authentication: { signedOut: 'noErrors' },
            email: 'awaitingVerification'
          })
        ) {
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
  return {
    signUpEmailPassword,
    isLoading,
    isSuccess,
    isError,
    error,
    needsEmailVerification,
    accessToken,
    user
  }
}
