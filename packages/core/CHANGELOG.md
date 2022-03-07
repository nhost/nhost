# @nhost/core

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

  The new `@nhost/core` package is written with tree-shakability in mind. No dead code should be included by a subsequent bundler.

  See [#198](https://github.com/nhost/nhost/issues/198)

- 207ae38: ## Stable authentication state

  Until now, the Nhost SDK authentication state and its context (access Token, refresh token...) was not held with a reliable system, ending in unconsistencies e.g. [#189](https://github.com/nhost/nhost/issues/189), [#202](https://github.com/nhost/nhost/issues/202), [#186](https://github.com/nhost/nhost/issues/186), [#195](https://github.com/nhost/nhost/issues/195).
  The `@nhost/core` handles authentication state as a finite state machine with [xstate](https://github.com/statelyai/xstate). Xstate is framework agnostic and the authentication state will be easily plugable in most reactive frameworks such as React, Vue and Svelte.
