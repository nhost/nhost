# @nhost/hasura-auth-js

## 1.0.13

### Patch Changes

- Updated dependencies [7b5f00d]
- Updated dependencies [58e1485]
  - @nhost/core@0.3.12

## 1.0.12

### Patch Changes

- Updated dependencies [0b1cb62]
  - @nhost/core@0.3.11

## 1.0.11

### Patch Changes

- 63d6059: Add TSDoc information about Nhost client options
- 63d6059: Set onTokenChanged before the state interpreter started
  Fixes [#384](https://github.com/nhost/nhost/issues/384), thanks [@noverby](https://github.com/noverby)
- 63d6059: Trigger onTokenChanged when token changes
  Fixes [#373](https://github.com/nhost/nhost/issues/373), thanks [@yureckey](https://github.com/yureckey)
- Updated dependencies [63d6059]
- Updated dependencies [63d6059]
  - @nhost/core@0.3.10

## 1.0.10

### Patch Changes

- 2c97db6: Keep authentication status and access token in sync
  The authentication events where not set correctly, leading the main Nhost client not to update internal states of storage/graphql/functions sub-clients when using non-react clients.
  The use of private fields (`#`) is also avoided as they conflict with the use of proxies in Vue, leading to errors in the upcoming Vue library.
  Fixes #373 and #378
- Updated dependencies [2c97db6]
  - @nhost/core@0.3.9

## 1.0.9

### Patch Changes

- 058956b: Add missing provider types
  `strava`, `gitlab`, and `bitbucket` were missing from the list of providers in Typescript and are now available.
- 058956b: Add `emailVerified`, `phoneNumber`, `phoneNumberVerified`, and `activeMfaType` to User type

  Some information is missing in the `User` payload (see [this issue](https://github.com/nhost/nhost/issues/306)). The above properties have been added in the Typescript `User` type and are available when using Hasura Auth versions from [this pull request](https://github.com/nhost/hasura-auth/pull/128) (tentative version number: `0.5.1`)

- Updated dependencies [058956b]
- Updated dependencies [7cf875f]
  - @nhost/core@0.3.8

## 1.0.8

### Patch Changes

- 6be3758: bug: Correct OAuth provider link.

## 1.0.7

### Patch Changes

- Updated dependencies [16a6c50]
  - @nhost/core@0.3.4

## 1.0.4

### Patch Changes

- correct dependencies

  See this related issues:

  - [nhost](https://github.com/nhost/nhost/issues/326)
  - [pnpm](https://github.com/pnpm/pnpm/issues/4348)

- Updated dependencies
  - @nhost/core@0.3.2

## 1.0.2

### Patch Changes

- 6eeb9d2: Wait for the authentication status to be known before executing auth actions
  The auth client was able to start actions such as signUp or signIn before the authentication state was ready (e.g. before initial refresh token could be processed).
  This patch solves the problem in waiting for the authentication status to be known before running these actions.
- Updated dependencies [4420c0e]
  - @nhost/core@0.3.1

## 1.0.1

### Patch Changes

- ab36f90: Correct access to user/session information through getUser/getSession/isReady function when authentication state is not ready yet
  In some cases e.g. NextJS build, `auth.getUser()`, `auth.getSession()` or `auth.isReady()` should be accessible without raising an error.

## 1.0.0

### Major Changes

- 744fd69: Use `@nhost/core` and its state machine

  `@nhost/nhost-js` and `@nhost/hasura-auth-js` now use the xstate-based state management system from `@nhost/core`.

  The client initiation remains the same, although the `clientStorage` and `clientStorageType` are deprecated in favor of `clientStorageGetter (key:string) => string | null | Promise<string | null>` and `clientStorageSetter: (key: string, value: string | null) => void | Promise<void>`.

### Minor Changes

- 744fd69: Unify vanilla, react and next APIs so they can work together
  React and NextJS libraries now works together with `@nhost/nhost-js`. It also means the Nhost client needs to be initiated before passing it to the React provider.
  See the [React](https://docs.nhost.io/reference/react#configuration) and [NextJS](https://docs.nhost.io/reference/nextjs/configuration) configuration documentation for additional information.

### Patch Changes

- 744fd69: remove `nhost.auth.verifyEmail`
  Theres's a /verify endpoint in hasura-auth, but the sdk is not even using it as
  1. the user follows the /verify link in the email
  2. hasura-auth validates the link, attaches the token and redirects to the frontend
  3. the sdk gets the refresh token from the url
  4. the sdk consumes the refresh token
- Updated dependencies [744fd69]
  - @nhost/core@0.3.0

## 0.1.15

### Patch Changes

- e688600: fix: current options when sign in with a provider
  We currently only support setting the redirectTo option for providers.
  This patch removes the options that do not work and adds the redirectTo option correctly to the provider sign-in URL.
- 8f7643a: Change target ES module build target to es2019
  Some systems based on older versions of Webpack or Babel don't support the current esbuild configuration e.g, [this issue](https://github.com/nhost/nhost/issues/275).
- e688600: fix: Correct available options for provider sign-in.
- 50b9d76: feat: correct available providers (Discord & Twitch added)

## 0.1.14

### Patch Changes

- c8f2488: build npm package with esbuild instead of vite. Vite does not build isomorphic packages correctly, in particular the dependency to axios

## 0.1.13

### Patch Changes

- 2e1c055: Axios causes some trouble when used NodeJS / CommonJS. Any code importing `axios` now does so in using the `require()` syntax

## 0.1.12

### Patch Changes

- a880583: - Improve typings (close [this PR](https://github.com/nhost/hasura-auth-js/pull/15))
  - Add the metadata field introduced in [hasura-auth 0.2.0](https://github.com/nhost/hasura-auth/releases/tag/v0.2.0) (close [this PR](https://github.com/nhost/hasura-auth-js/pull/18))
- 03562af: Build in CommonJS and ESM instead of UMD and ESM as the UMD bundle generated by the default Vite lib build mode doesn't work with NodeJS

## 0.1.11

### Patch Changes

- 7c3a7be: Remove http timeout options (fix[#157](https://github.com/nhost/nhost/issues/157))
  This new release also comes up with both ESM and CommonJS distributions and solves [#151](https://github.com/nhost/nhost/issues/151)
