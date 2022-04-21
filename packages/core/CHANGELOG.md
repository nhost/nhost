# @nhost/core

## 0.3.12

### Patch Changes

- 7b5f00d: Avoid error when BroadcastChannell is not available
- 58e1485: Fix invalid password and email errors on sign up
  When signin up, an invalid password was returning the `invalid-email` error, and an invalid email was returning `invalid-password`.
  This is now in order.

## 0.3.11

### Patch Changes

- 0b1cb62: Use native `BroadcastChannel` instead of the `broadcast-channel` package
  The `broadcast-channel` depends on `node-gyp-build`, which can cause issues when deploying on Vercel as it is a native dependency.
  The added value of `broadcast-channel` is to be able to communicate the change of authentication state accross processes in a NodeJs / Electron environment, but this is considered an edge case for now.
  See [Vercel official documentation](https://vercel.com/support/articles/why-does-my-serverless-function-work-locally-but-not-when-deployed#native-dependencies).

## 0.3.10

### Patch Changes

- 63d6059: Set onTokenChanged before the state interpreter started
  Fixes [#384](https://github.com/nhost/nhost/issues/384), thanks [@noverby](https://github.com/noverby)
- 63d6059: Trigger onTokenChanged when token changes
  Fixes [#373](https://github.com/nhost/nhost/issues/373), thanks [@yureckey](https://github.com/yureckey)

## 0.3.9

### Patch Changes

- 2c97db6: Keep authentication status and access token in sync
  The authentication events where not set correctly, leading the main Nhost client not to update internal states of storage/graphql/functions sub-clients when using non-react clients.
  The use of private fields (`#`) is also avoided as they conflict with the use of proxies in Vue, leading to errors in the upcoming Vue library.
  Fixes #373 and #378

## 0.3.8

### Patch Changes

- 058956b: Add missing provider types
  `strava`, `gitlab`, and `bitbucket` were missing from the list of providers in Typescript and are now available.
- 058956b: Add `emailVerified`, `phoneNumber`, `phoneNumberVerified`, and `activeMfaType` to User type

  Some information is missing in the `User` payload (see [this issue](https://github.com/nhost/nhost/issues/306)). The above properties have been added in the Typescript `User` type and are available when using Hasura Auth versions from [this pull request](https://github.com/nhost/hasura-auth/pull/128) (tentative version number: `0.5.1`)

- 7cf875f: Export error code payloads and type

## 0.3.7

### Patch Changes

- 16a6c50: Correct autoSignIn

## 0.3.3

### Patch Changes

- correct dependencies

  See this related issues:

  - [nhost](https://github.com/nhost/nhost/issues/326)
  - [pnpm](https://github.com/pnpm/pnpm/issues/4348)

## 0.3.1

### Patch Changes

- 4420c0e: Check if `window.location` exists

  When using [Expo](https://expo.dev/), `window` can be an object while `window.location` is `undefined`. It lead to [this issue](https://github.com/nhost/nhost/issues/309).

## 0.3.0

### Minor Changes

- 744fd69: Unify vanilla, react and next APIs so they can work together
  React and NextJS libraries now works together with `@nhost/nhost-js`. It also means the Nhost client needs to be initiated before passing it to the React provider.
  See the [React](https://docs.nhost.io/reference/react#configuration) and [NextJS](https://docs.nhost.io/reference/nextjs/configuration) configuration documentation for additional information.

### Patch Changes

- 744fd69: Rename `@nhost/client` to `@nhost/core`
  The `@nhost/client` name was somehow misleading, as it was implying it could somehow work as a vanilla client, whereas it only contained the state machine that could be used for vanilla or framework specific libraries e.g. `@nhost/react`.

  It is therefore renamed to `@nhost/core`, and keeps the same versionning and changelog.

## 0.2.1

### Patch Changes

- 0d8afde: Bump xstate version 4.30.5

## 0.2.0

### Minor Changes

- 207ae38: Improvements on `autoSignIn`

  Auto login enables authentication from a link sent by email.
  It parses the url query parameters of the browser and looks for a possible refresh token to consume and authenticate.
  Although the mechanism existed already, it now broadcasts the refresh token to other tabs in the same browser, so they can also authenticate automatically.

- 207ae38: Improvements on `autoRefreshToken`

  Auto refresh now uses a client-side timestamp from the instant of its creation to the access token expiration interval. As a result, there is less change of refresh and access token becoming stale or out of sync.

- 207ae38: Tree-shakable API

  The new `@nhost/client` package is written with tree-shakability in mind. No dead code should be included by a subsequent bundler.

  See [#198](https://github.com/nhost/nhost/issues/198)

- 207ae38: ## Stable authentication state

  Until now, the Nhost SDK authentication state and its context (access Token, refresh token...) was not held with a reliable system, ending in unconsistencies e.g. [#189](https://github.com/nhost/nhost/issues/189), [#202](https://github.com/nhost/nhost/issues/202), [#186](https://github.com/nhost/nhost/issues/186), [#195](https://github.com/nhost/nhost/issues/195).
  The `@nhost/client` handles authentication state as a finite state machine with [xstate](https://github.com/statelyai/xstate). Xstate is framework agnostic and the authentication state will be easily plugable in most reactive frameworks such as React, Vue and Svelte.
