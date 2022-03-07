# @nhost/react

## 0.2.1

### Patch Changes

- 0d8afde: Bump xstate version 4.30.5
- Updated dependencies [0d8afde]
  - @nhost/core@0.2.1

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
  - @nhost/core@0.2.0
