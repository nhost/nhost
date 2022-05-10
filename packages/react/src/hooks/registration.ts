import { useMemo } from 'react'

import { SignUpOptions, User, USER_ALREADY_SIGNED_IN } from '@nhost/core'
import { useSelector } from '@xstate/react'

import {
  ActionHookSuccessState,
  CommonActionHookState,
  useAuthenticationStatus,
  useAuthInterpreter
} from './common'

interface SignUpEmailPasswordHookState extends CommonActionHookState, ActionHookSuccessState {
  /** @return `true` if an email is required to complete the action, and that a verificaiton email has been sent to complete the action. */
  needsEmailVerification: boolean
  /** User information */
  user: User | null
  /** Access token (JWT) */
  accessToken: string | null
}

type SignUpEmailPasswordHandlerResult = Omit<SignUpEmailPasswordHookState, 'isLoading'>

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

interface SignUpEmailPasswordHookResult extends SignUpEmailPasswordHookState {
  /** Used for a new user to sign up. Returns a promise with the current context */
  signUpEmailPassword: SignUpEmailPasswordHandler
}

interface SignUpEmailPasswordHook {
  (options?: SignUpOptions): SignUpEmailPasswordHookResult
  /** @deprecated */
  (email?: string, password?: string, options?: SignUpOptions): SignUpEmailPasswordHookResult
}

/**
 * Email and Password Sign-Up
 * @example

```js
const {
  signUpEmailPassword,
  isLoading,
  isSuccess,
  needsEmailVerification,
  isError,
  error,
} = useSignUpEmailPassword();
```
 * @example
```jsx
import { useState } from 'react';
import { useSignUpEmailPassword } from '@nhost/react';

const Component = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const {
    signUpEmailPassword,
    isLoading,
    isSuccess,
    needsEmailVerification,
    isError,
    error,
  } = useSignUpEmailPassword();

  return (
    <div>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
      />
      <button onClick={() => signUpEmailPassword(email, password)}>
        Register
      </button>
      {isSuccess && (
        <div>Your account have beed created! You are now authenticated</div>
      )}
      {needsEmailVerification && (
        <div>
          Please check your mailbox and follow the verification link to verify
          your email
        </div>
      )}
    </div>
  );
};
```
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
    service.state.matches({
      authentication: { signedOut: 'noErrors' },
      email: 'awaitingVerification'
    })

  const signUpEmailPassword: SignUpEmailPasswordHandler = (
    valueEmail?: string | unknown,
    valuePassword = statePassword,
    valueOptions = stateOptions
  ) =>
    new Promise<SignUpEmailPasswordHandlerResult>((resolve) => {
      const { changed, context } = service.send({
        type: 'SIGNUP_EMAIL_PASSWORD',
        email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
        password: valuePassword,
        options: valueOptions
      })
      if (!changed) {
        return resolve({
          error: USER_ALREADY_SIGNED_IN,
          accessToken: context.accessToken.value,
          isError: true,
          isSuccess: false,
          needsEmailVerification: false,
          user: context.user
        })
      }
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
