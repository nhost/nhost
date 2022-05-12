import { signUpEmailPasswordPromise, SignUpEmailPasswordState, SignUpOptions } from '@nhost/core'
import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './common'

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

interface SignUpEmailPasswordHookResult extends SignUpEmailPasswordState {
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
  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )

  const error = useSelector(
    service,
    (state) => state.context.errors.registration || null,
    (a, b) => a?.error === b?.error
  )

  const isLoading = useSelector(service, (state) =>
    state.matches({ authentication: 'registering' })
  )

  const needsEmailVerification = useSelector(service, (state) =>
    state.matches({
      authentication: { signedOut: 'noErrors' },
      email: 'awaitingVerification'
    })
  )
  const isSuccess = useSelector(service, (state) =>
    state.matches({
      authentication: 'signedIn'
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
