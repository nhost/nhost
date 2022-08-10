# @nhost/react

## 0.12.1

### Patch Changes

- @nhost/nhost-js@1.4.8

## 0.12.0

### Minor Changes

- 84ba29dd: Introduce `useSignInSmsPasswordless`

  ```ts
  const {
    signInSmsPasswordless,
    sendOtp,
    needsOtp,
    isLoading,
    isSuccess,
    isError,
    error
  } = useSignInSmsPasswordless()
  ```

  1. The `signInSmsPasswordless` action will send a one-time password to the given phone number.
  2. The client is then awaiting the OTP. `needsOtp` equals true
  3. After the code is received by SMS, the client sends the code with `sendOtp`. On success, the client is authenticated, and `isSuccess` equals `true`.

  Any error is monitored through `isError` and `error`. While the `signInSmsPasswordless` and `sendOtp` actions are running, `isLoading` equals `true`

### Patch Changes

- 10beea72: Fix React Native build: Export `package.json` for all npm packages.
- Updated dependencies [747aa969]
- Updated dependencies [10beea72]
  - @nhost/core@0.7.6
  - @nhost/hasura-storage-js@0.5.3
  - @nhost/nhost-js@1.4.7

## 0.11.2

### Patch Changes

- Updated dependencies [197d1d5c]
  - @nhost/core@0.7.5
  - @nhost/hasura-storage-js@0.5.2
  - @nhost/nhost-js@1.4.6

## 0.11.1

### Patch Changes

- Updated dependencies [6eaa5c79]
  - @nhost/core@0.7.4
  - @nhost/hasura-storage-js@0.5.1
  - @nhost/nhost-js@1.4.5

## 0.11.0

### Minor Changes

- 4f928756: Extend file upload parameters

  - `bucketId` is available everywhere as an option
  - It is possible to pass files as a parameter on a multiple `upload`, making the `add` action optional.
  - The `add` and `upload` actions of multiple file upload accepts both a `File`, an array of `File` items, and a `FileList`

### Patch Changes

- Updated dependencies [4f928756]
  - @nhost/hasura-storage-js@0.5.0
  - @nhost/nhost-js@1.4.4

## 0.10.0

### Minor Changes

- f9854b15: Upload multiple files with `useMultipleFilesUpload`
- f9854b15: `useFileUpload`: keep track of upload progress and cancel upload

### Patch Changes

- Updated dependencies [f9854b15]
- Updated dependencies [f9854b15]
  - @nhost/hasura-storage-js@0.4.0
  - @nhost/core@0.7.3
  - @nhost/nhost-js@1.4.3

## 0.9.2

### Patch Changes

- dbc10e62: fixed `exports` field to support imports in a server-side environment
- Updated dependencies [dbc10e62]
  - @nhost/core@0.7.2
  - @nhost/nhost-js@1.4.2

## 0.9.1

### Patch Changes

- Updated dependencies [b8f4b75b]
  - @nhost/nhost-js@1.4.1

## 0.9.0

### Minor Changes

- 6f0a3005: `sendMfaOtp` now returns a promise
  When using `useSignInEmailPassword`, the `sendMfaOtp` was `void`. It now returns a promise that resolves when the server returned the result of the OTP code submission, and returns `isSuccess`, `isError`, and `error`.

### Patch Changes

- Updated dependencies [6f0a3005]
- Updated dependencies [6f0a3005]
  - @nhost/nhost-js@1.4.0
  - @nhost/core@0.7.1

## 0.8.0

### Minor Changes

- c1613394: Deanonymisation
  Once signed in anonymously, users can deanonymise using `nhost.auth.deanonymize`.
  Deanonymisation works the same way as email+password sign-up or passwordless sign-in. The related methods, hooks in React and composables in Vue can therefore be used for deanonymising users, such as `nhost.auth.signUp`, `useSignUpEmailPassword`, and `useSignInEmailPasswordless`.

### Patch Changes

- Updated dependencies [c1613394]
  - @nhost/core@0.7.0
  - @nhost/nhost-js@1.3.0

## 0.7.13

### Patch Changes

- 08a37aae: correct rewriting options when `clientUrl` is not available
  The client URL is set to `window.location.origin`, so it can rewrite redirection urls that are passed on to authenticaion methods. However, `clientUrl` is set to `''` when running on the server side. This fix then avoid raising an error when trying to rewrite `redirectTo` on non-browser environment, and forces `useProviderLink` to be rendered on the client side.
- Updated dependencies [08a37aae]
  - @nhost/core@0.6.5
  - @nhost/nhost-js@1.2.4

## 0.7.12

### Patch Changes

- ebad0936: reverted ESM related changes
- Updated dependencies [ebad0936]
  - @nhost/core@0.6.4
  - @nhost/nhost-js@1.2.3

## 0.7.11

### Patch Changes

- 1b37b9f6: fix: ESM import path fixes
- Updated dependencies [1b37b9f6]
  - @nhost/core@0.6.3
  - @nhost/nhost-js@1.2.2

## 0.7.10

### Patch Changes

- 78341491: fix: Next.js and React issues with ESM packages
  chore: Updated output bundle names
- Updated dependencies [78341491]
  - @nhost/core@0.6.2
  - @nhost/nhost-js@1.2.1

## 0.7.9

### Patch Changes

- bc11c9e5: chore: Changed copy script to support Windows
  fix: Fixed warnings about unknown globals occurring while building the packages
- 2b2f8e91: fix: ESM related issues in Node environments
  chore: Improved the way different formats are exposed via `exports` field in package.js
- Updated dependencies [bc11c9e5]
- Updated dependencies [2b2f8e91]
- Updated dependencies [858014e4]
  - @nhost/core@0.6.1
  - @nhost/nhost-js@1.2.0

## 0.7.8

### Patch Changes

- 7c8f0926: add the `mfa` ticket to `useSignInEmailPassword`
  The `useSignInEmailPassword` hook was not returning the MFA ticket. This releases fixes the issue.
- 7c8f0926: use the [same methods and typings](https://github.com/nhost/nhost/tree/feat/vue/packages/core/src/promises) to interact with xstate machines in both `@nhost/hasura-auth-js`, `@nhost/react` hooks and `@nhost/vue` composables
  Both `@nhost/react`, `@nhost/hasura-auth-js` and `@nhost/vue` interact with the authentication state in a similar way. As a result, the same code was repeated three times, with risks of insonsistency and difficult maintainability. `@nhost/core` now contains the logic and Typescript interfaces that are used in the Vanilla client, React hooks and Vue composables.
- Updated dependencies [7c8f0926]
- Updated dependencies [7c8f0926]
- Updated dependencies [7c8f0926]
  - @nhost/core@0.6.0
  - @nhost/nhost-js@1.1.14

## 0.7.7

### Patch Changes

- Updated dependencies [6c423394]
  - @nhost/core@0.5.6
  - @nhost/nhost-js@1.1.13

## 0.7.6

### Patch Changes

- Updated dependencies [0b58894e]
- Updated dependencies [c7a407f1]
  - @nhost/core@0.5.5
  - @nhost/nhost-js@1.1.12

## 0.7.5

### Patch Changes

- 9d32314: Return an error when trying sign to in/up/out from hooks while in the wrong authentication status
  The actions of the authentication hooks were not resolving the promise when executed from the wrong authentication status.
  They now return an error.
- 236ce72: Correct `useSignUpEmailPassword` loading state
- 236ce72: Correct email verification states
  email verification returns `false` when the client has started and it is still undetermined
- Updated dependencies [9d32314]
- Updated dependencies [e094e68]
- Updated dependencies [236ce72]
  - @nhost/core@0.5.4
  - @nhost/nhost-js@1.1.11

## 0.7.4

### Patch Changes

- 2887ce0: @xstate/react bump to support React 18

## 0.7.3

### Patch Changes

- 584976d: - publishable directory structure changes (ESM, CJS and UMD included in the output)
  - build system improvements
  - fixed some bundling concerns (https://github.com/nhost/nhost/issues/428)
- Updated dependencies [584976d]
  - @nhost/core@0.5.3
  - @nhost/nhost-js@1.1.10

## 0.7.2

### Patch Changes

- @nhost/nhost-js@1.1.9

## 0.7.1

### Patch Changes

- 58fa2a2: Improve loading status
  The `loading` status indicates the authentication is not yet known to the client when it starts. Once the client is ready, the authentication status is either signed in, or signed out.
  When the user was trying to authenticate, the `loading` status was set to `true` until the result of the authentication was known.
  The client now only return `loading: true` on startup, and in no other cases.
- 58fa2a2: Look for a valid refresh token both the URL and local storage
  When auto-signin was activated, the client was not taking into account the refresh token in the URL if a token was already stored locally.
  The user was then not able to authenticate from a link when the refresh token stored locally was invalid or expired.
  When auto-signin is activated, the client now checks and tries tokens from both the URL and the local storage, starting with the URL.
  - @nhost/nhost-js@1.1.8

## 0.7.0

### Minor Changes

- 42edb74: Adapt to React 18

### Patch Changes

- b56162a: prefer clientStorage/clientStorageType to clientStorageGetter/clientStorageSetter
- 1fb51a7: Rename user data hooks to make them all start with `userUser...`
  The hooks that help to access user data were not consistently named.
  The following hooks have been therefore renamed:

  - `useAvatarUrl` -> `useUserAvatarUrl`
  - `useDefaultRole` -> `useUserDefaultRole`
  - `useDisplayName` -> `useUserDisplayName`
  - `useEmail` -> `useUserEmail`
  - `useIsAnonymous` -> `useUserIsAnonymous`

  Their former names are still available for backwards compatibility, but are flagged as deprecated.

- 54e1873: Fix: add authentication headers to GraphQL operations when authenticated
- Updated dependencies [185f39e]
  - @nhost/nhost-js@1.1.7

## 0.6.1

### Patch Changes

- @nhost/nhost-js@1.1.6

## 0.6.0

### Minor Changes

- 616e320: Remove `refreshToken` from the url when `autoSignIn` is set
  On startup, when the `autoSignIn` option is set to `true`, the client now removes it from the URL when the page loads.
- 1ce55c5: Add new hooks: `useDecodedAccessToken()`, `useHasuraClaims()`, and `useHasuraClaim(name: string)`
- 616e320: Look for the refresh token both in the query parameters and in the hash
  Until now, after redirecting from an email, Hasura-auth puts refresh tokens in the hash part of the url. It is a problem when using SSR as the hash is not accessible to the server. This behaviour is likely to change. As a result, the client now parses both the hash and the query parameters of the url.
  See [this issue](https://github.com/nhost/hasura-auth/issues/148) to keep track of the progress on Hasura-auth.

### Patch Changes

- 49545c0: Remove filtering of `useLayoutEffect` from logs
  The `suppressConsoleMessage` method was meant to suppress incorrect `useLayoutEffect` messages raised on Nextjs server-side renderings. Its implementation had an impact on the normal functionning of logging (see [#447](https://github.com/nhost/nhost/issues/447)).
  This filtering was necessary when using former versions of xstate and can now be removed.
- b52b4fc: Bump xstate to latest version (`4.31.0`)
- Updated dependencies [d49b837]
  - @nhost/nhost-js@1.1.5

## 0.5.7

### Patch Changes

- @nhost/nhost-js@1.1.4

## 0.5.6

### Patch Changes

- 5ee395e: Ensure the session is destroyed when signout is done
  In the `useSignOut` hook, `signOut` now returns a promise. We are now sure the user session is empty once the promise is resolved.
  - @nhost/nhost-js@1.1.3

## 0.5.5

### Patch Changes

- @nhost/nhost-js@1.1.2

## 0.5.4

### Patch Changes

- @nhost/nhost-js@1.1.1

## 0.5.3

### Patch Changes

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
