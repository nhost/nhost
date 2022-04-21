# @nhost/react

## 0.5.5

### Patch Changes

- @nhost/nhost-js@1.1.2

## 0.5.4

### Patch Changes

- @nhost/nhost-js@1.1.1

## 0.5.3

### Patch Changes

- Updated dependencies [ab06e96]
- Updated dependencies [ccba0b5]
  - @nhost/nhost-js@1.1.0

## 0.5.2

### Patch Changes

- @nhost/nhost-js@1.0.11

## 0.5.1

### Patch Changes

- Updated dependencies [2c97db6]
  - @nhost/nhost-js@1.0.10

## 0.5.0

### Minor Changes

- 7135aee: Add user and accessToken to authentication hooks

  Hooks that can complete a successful authentication now have two additional `user` and `accessToken` exported states:

  - `useSignInEmailPassword`
  - `useSignInAnonymous`
  - `useSignUpEmailPassword`

- 587eaff: Return a promise with the current context to hooks actions
  It is now possible to get the result of an action. Hook handlers return the action context in a promise.

  ```jsx
  const { signInEmailPasswordless, isError } = useSignInEmailPasswordless()
  const MyComponent = () => {
      return <div>
                  <button onClick={async () => {
                      const { isSuccess, isError, error } = await signInEmailPasswordless('johan@ikea.se')
                      if (isError) {
                          console.log(error)
                      }}}/>
                  {isError && <div>an error occurred</div>}
              <div>
  }

  ```

### Patch Changes

- 7cf875f: Deprecate the use of values sent as hook parameters

  Although handlers parameters of authentication hooks can be given when creating the hook, it is recommended to use them when executing the handler. For instance, instead of:

  ```js
  const { signInEmailPasswordless } = useSignInEmailPasswordless('nuno@fcporto.pt')
  signInEmailPasswordless()
  ```

  It is recommended to use the following syntax:

  ```js
  const { signInEmailPasswordless } = useSignInEmailPasswordless()
  signInEmailPasswordless('nuno@fcporto.pt')
  ```

  No breaking change has been introduced. For instance, `useSignUpEmailPassword('szilard@brussels.be','1234', options)` will appear as deprecated but will work, while `useSignUpEmailPassword(options)` will work too.

  - @nhost/nhost-js@1.0.9

## 0.4.7

### Patch Changes

- @nhost/nhost-js@1.0.8

## 0.4.6

### Patch Changes

- @nhost/nhost-js@1.0.5

## 0.4.3

### Patch Changes

- correct dependencies

  See this related issues:

  - [nhost](https://github.com/nhost/nhost/issues/326)
  - [pnpm](https://github.com/pnpm/pnpm/issues/4348)

- Updated dependencies
  - @nhost/nhost-js@1.0.3

## 0.4.1

### Patch Changes

- @nhost/nhost-js@1.0.2

## 0.4.0

### Minor Changes

- 39df4d5: Deprecate `useAuthLoading` and introduce `useAuthenticationStatus`
  When using both `useAuthLoading` and `useAuthenticated` together, the hooks rerender independently from each other.
  As a result, when a user loads the page while he previously authenticated, the hooks values were chronologically:

  | isLoading | isAuthenticated |
  | --------- | --------------- |
  | `true`    | `false`         |
  | `false`   | `false`         |
  | `false`   | `true`          |

  The intermediate (`false`, `false`) is incorrect and is causing issues when using an authentication gate.

  It is therefore recommended to stop using `useAuthLoading`, and to use `useAuthenticationStatus` instead, in order to keep the loading state and the authentication in sync within the same hook.

  Usage:

  ```js
  const { isLoading, isAuthenticated } = useAuthenticationStatus()
  ```

  Fixes [this issue](https://github.com/nhost/nhost/issues/302)

## 0.3.1

### Patch Changes

- @nhost/nhost-js@1.0.1

## 0.3.0

### Minor Changes

- 744fd69: Introducing `useSendVerificationEmail`

  While `useSignInEmailPassword` automatically sends a verification email (when the backend is configured to do so), an user may sometime want to request for an verification email to be sent again. See the [documentation](https://docs.nhost.io/reference/react/hooks#send-email-verification) for further information about how to use this hook.

- 744fd69: Rename hooks and their methods to make them more explicit

  - `useEmailPasswordlessSignIn`
    - Hook renamed to `useSignInEmailPasswordless`
    - `signIn` renamed to `signInEmailPasswordless`
  - `useEmailPasswordSignIn`

    - Hook renamed to `useSignInEmailPassword`
    - `signIn` renamed to `signInEmailPassword`
    - `needsVerification` renamed to `needsEmailVerification`

  - `useEmailPasswordSignUp`

    - Hook renamed to `useSignUpEmailPassword`
    - `signUp` renamed to `signUpEmailPassword`
    - `needsVerification` renamed to `needsEmailVerification`

  - `useAnonymousSignIn`

    - Hook renamed to `useSignInAnonymous`
    - renamed `signIn` to `signInAnonymous`

  - `useChangeEmail`

    - `needsVerification` renamed to `needsEmailVerification`

- 744fd69: Introducing `useSignInAnonymous`

  Anonymous Sign-In is a feature that allows users to get a temporary id without attaching yet any personal information such as an email or a passowrd.

  Anonymous users can then run GraphQL operations, with a specific `public` role that is distinct from the default `user` role. The anonymous can then "deanonymize" their account at a later stage in attaching the missing registration information and an authentication method.

  **Note** Anonymous Sign-In is not available out of the box yet in the [Nhost cloud](https://app.nhost.io/), but will be available in the near future.

  **Note 2** The deanonymisation process is not yet available. This is also part of our roadmap.

  ```js
  const { signInAnonymous, isLoading, isSuccess, isError, error } = useSignInAnonymous()
  ```

  | Name              | Type                                                          | Notes                                                                                                                         |
  | ----------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
  | `signInAnonymous` | () => void                                                    | Registers an anonymous user                                                                                                   |
  | `isLoading`       | boolean                                                       | Returns `true` when the action is executing, `false` when it finished its execution.                                          |
  | `isSuccess`       | boolean                                                       | Returns `true` if the sign-up suceeded. Returns `false` if the new email needs to be verified first, or if an error occurred. |
  | `isError`         | boolean                                                       | Returns `true` if an error occurred.                                                                                          |
  | `error`           | {status: number, error: string, message: string} \| undefined | Provides details about the error.                                                                                             |

  #### Usage

  ```jsx
  import { useSignInAnonymous } from '@nhost/react'

  const Component = () => {
    const { signInAnonymous, isSuccess } = useSignInAnonymous(email, password)
    return (
      <div>
        <button onClick={signInAnonymous}>Anonymous sign-in</button>
        {isSuccess && <div>You are now signed in anonymously</div>}
      </div>
    )
  }
  ```

- 744fd69: Add options to `useProviderLink`

  Since [Hasura Auth version 0.4](https://github.com/nhost/hasura-auth/releases/tag/v0.4.0), it is possible to pass on options when signing up or signin in through an OAuth provider. It is now possible to determine these options in the `useProviderLink`, so it generates the right URL when using the provider links.

  See the [React documentation](https://docs.nhost.io/reference/react/hooks#oauth-providers) for additional information.

- 744fd69: Time-based One-Time Password Multi-Factor Authentication

  **Note** MFA is not available out of the box yet in the [Nhost cloud](https://app.nhost.io/), but will be available in the near future.

  When enabled in the backend, users that signed up with an email and a password can opt-in for an additional authentication security measure.
  MFA can be activated in using the new `useConfigMfa` hook.

  Two methods has been also added to `useEmailPasswordSignIn`: when MFA is active, authentication won't be a success straight after signin up with an email and a password.
  The new `needsMfaOtp` will then appear as `true`, and the authentication will succeed only when the user will have sent back the OTP code with `sendMfaOtp(code:string)`.

  ```js
  const { generateQrCode, isGenerating, isGenerated, qrCodeDataUrl, activateMfa, isActivating, isActivated, isError, error } =
    useConfigMfa(code?: string)
  ```

  | Name             | Type                                                          | Notes                                                                                                           |
  | ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
  | `generateQrCode` | () => void                                                    | Generates the QR code that will be used by the MFA app e.g. Google Authenticator or Authy.                      |
  | `isGenerating`   | boolean                                                       | Returns `true` if the QR code is generating but not yet available                                               |
  | `isGenerated`    | boolean                                                       | Returns `true` when the QR code has been successfully generated and is available                                |
  | `qrCodeDataUrl`  | string                                                        | Returns the QR code as a [Data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs) |
  | `activateMfa`    | (code?: string) => void                                       | Activate MFA from the code given by the MFA authentication application                                          |
  | `isActivating`   | boolean                                                       | Returns `true` when the activation code has been sent to the server, and we await server response               |
  | `isActivated`    | boolean                                                       | Returns `true` when MFA has been successfully activated                                                         |
  | `isError`        | boolean                                                       | Returns `true` if an error occurred.                                                                            |
  | `error`          | {status: number, error: string, message: string} \| undefined | Provides details about the error.                                                                               |

  #### Usage

  ```jsx
  import { useConfigMfa } from '@nhost/react'
  import { useState } from 'react'

  export const Mfa: React.FC = () => {
    const [code, setCode] = useState('')
    const { generateQrCode, activateMfa, isActivated, isGenerated, qrCodeDataUrl } =
      useConfigMfa(code)

    return (
      <div>
        {!isGenerated && (
          <button block appearance="primary" onClick={generateQrCode}>
            Generate
          </button>
        )}
        {isGenerated && !isActivated && (
          <div>
            <img alt="qrcode" src={qrCodeDataUrl} />
            <input value={code} onChange={onChange={(event) => setCode(event.target.value)}} placeholder="Enter activation code" />
            <button block appearance="primary" onClick={activateMfa}>
              Activate
            </button>
          </div>
        )}
        {isActivated && <div>MFA has been activated!!!</div>}
      </div>
    )
  }

  ```

- 744fd69: Unify vanilla, react and next APIs so they can work together
  React and NextJS libraries now works together with `@nhost/nhost-js`. It also means the Nhost client needs to be initiated before passing it to the React provider.
  See the [React](https://docs.nhost.io/reference/react#configuration) and [NextJS](https://docs.nhost.io/reference/nextjs/configuration) configuration documentation for additional information.

### Patch Changes

- Updated dependencies [744fd69]
- Updated dependencies [744fd69]
  - @nhost/nhost-js@1.0.0

## 0.2.1

### Patch Changes

- 0d8afde: Bump xstate version 4.30.5
- Updated dependencies [0d8afde]
  - @nhost/client@0.2.1

## 0.2.0

### Minor Changes

- 207ae38: New React client

  This release brings a full rewrite of the React client, to make it tree shakable and fully reactive.
  See the [documentation](https://docs.nhost.io/reference/react) for further information.

  ### Hooks

  - `useAccessToken`
  - `useAnonymousSignIn`
  - `useAuthenticated`
  - `useChangeEmail`
  - `useChangePassword`
  - `useEmail`
  - `useEmailPasswordlessSignIn`
  - `useEmailPasswordSignIn`
  - `useEmailPasswordSignUp`
  - `useIsAnonymous`
  - `useAuthLoading`
  - `useNhost`
  - `useNhostBackendUrl`
  - `useNhostInterpreter`
  - `useResetPassword`
  - `useSignOut`
  - `useUserData`
  - `useUserLocale`
  - the `useNhostAuth` has not been included. Use `useAuthenticated` together with `useAuthLoading` and `useUserData` instead

  Closes [#189](https://github.com/nhost/nhost/issues/189), [#127](https://github.com/nhost/nhost/issues/127), [#186](https://github.com/nhost/nhost/issues/186), and [#195](https://github.com/nhost/nhost/issues/195)

### Patch Changes

- Updated dependencies [207ae38]
  - @nhost/client@0.2.0
