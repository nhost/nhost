# @nhost/nhost-js

## 1.4.8

### Patch Changes

- Updated dependencies [93cc6920]
  - @nhost/hasura-auth-js@1.4.1

## 1.4.7

### Patch Changes

- 10beea72: Fix React Native build: Export `package.json` for all npm packages.
- Updated dependencies [18ac56d0]
- Updated dependencies [10beea72]
  - @nhost/hasura-auth-js@1.4.0
  - @nhost/hasura-storage-js@0.5.3

## 1.4.6

### Patch Changes

- @nhost/hasura-auth-js@1.3.4
- @nhost/hasura-storage-js@0.5.2

## 1.4.5

### Patch Changes

- @nhost/hasura-auth-js@1.3.3
- @nhost/hasura-storage-js@0.5.1

## 1.4.4

### Patch Changes

- Updated dependencies [4f928756]
  - @nhost/hasura-storage-js@0.5.0

## 1.4.3

### Patch Changes

- Updated dependencies [f9854b15]
- Updated dependencies [f9854b15]
  - @nhost/hasura-storage-js@0.4.0
  - @nhost/hasura-auth-js@1.3.2

## 1.4.2

### Patch Changes

- dbc10e62: fixed `exports` field to support imports in a server-side environment
- Updated dependencies [dbc10e62]
  - @nhost/hasura-auth-js@1.3.1
  - @nhost/hasura-storage-js@0.3.4

## 1.4.1

### Patch Changes

- b8f4b75b: Introduce `subdomain` and `region` alongside `backendUrl`.

  `backendUrl` should now be used only for self-hosting. `subdomain` and `region` should be used when interacting with the hosted Nhost platform.

## 1.4.0

### Minor Changes

- 6f0a3005: Complete sign-in when email+password MFA is activated
  It was not possible to complete authentication with `nhost.auth.signIn` in sending the TOTP code when email+password MFA was activated.
  An user that activated MFA can now sign in with the two following steps:
  ```js
  await nhost.auth.signIn({ email: 'email@domain.com', password: 'not-my-birthday' })
  // Get the one-time password with an OTP application e.g. Google Authenticator
  await nhost.auth.signIn({ otp: '123456' })
  ```

### Patch Changes

- Updated dependencies [6f0a3005]
  - @nhost/hasura-auth-js@1.3.0

## 1.3.0

### Minor Changes

- c1613394: Deanonymisation
  Once signed in anonymously, users can deanonymise using `nhost.auth.deanonymize`.
  Deanonymisation works the same way as email+password sign-up or passwordless sign-in. The related methods, hooks in React and composables in Vue can therefore be used for deanonymising users, such as `nhost.auth.signUp`, `useSignUpEmailPassword`, and `useSignInEmailPasswordless`.

### Patch Changes

- Updated dependencies [c1613394]
  - @nhost/hasura-auth-js@1.2.0

## 1.2.4

### Patch Changes

- @nhost/hasura-auth-js@1.1.14

## 1.2.3

### Patch Changes

- ebad0936: reverted ESM related changes
- Updated dependencies [ebad0936]
  - @nhost/hasura-auth-js@1.1.13
  - @nhost/hasura-storage-js@0.3.3

## 1.2.2

### Patch Changes

- 1b37b9f6: fix: ESM import path fixes
- Updated dependencies [1b37b9f6]
  - @nhost/hasura-auth-js@1.1.12
  - @nhost/hasura-storage-js@0.3.2

## 1.2.1

### Patch Changes

- 78341491: fix: Next.js and React issues with ESM packages
  chore: Updated output bundle names
- Updated dependencies [78341491]
  - @nhost/hasura-auth-js@1.1.11
  - @nhost/hasura-storage-js@0.3.1

## 1.2.0

### Minor Changes

- 858014e4: New `adminSecret` option
  It is now possible to add a new adminSecret when creating a Nhost client. When set, it is sent as an `x-hasura-admin-secret` header for all GraphQL, Storage, and Serverless Functions requests.

### Patch Changes

- bc11c9e5: chore: Changed copy script to support Windows
  fix: Fixed warnings about unknown globals occurring while building the packages
- 2b2f8e91: fix: ESM related issues in Node environments
  chore: Improved the way different formats are exposed via `exports` field in package.js
- Updated dependencies [bc11c9e5]
- Updated dependencies [2b2f8e91]
- Updated dependencies [858014e4]
  - @nhost/hasura-auth-js@1.1.10
  - @nhost/hasura-storage-js@0.3.0

## 1.1.14

### Patch Changes

- 7c8f0926: add `devTools` option to the Nhost client
  The Nhost client now accepts a `devTools` parameter that can be used to inspect the authentication state machine with [@xstate/inspect](https://xstate.js.org/docs/packages/xstate-inspect/)
- Updated dependencies [7c8f0926]
- Updated dependencies [7c8f0926]
  - @nhost/hasura-auth-js@1.1.9

## 1.1.13

### Patch Changes

- @nhost/hasura-auth-js@1.1.8

## 1.1.12

### Patch Changes

- @nhost/hasura-auth-js@1.1.7

## 1.1.11

### Patch Changes

- e094e68: chore: bump axios from 0.26.0 to 0.27.2
  fix: add Content-Type to file upload request headers
- Updated dependencies [9d32314]
- Updated dependencies [e094e68]
  - @nhost/hasura-auth-js@1.1.6
  - @nhost/hasura-storage-js@0.2.2

## 1.1.10

### Patch Changes

- 584976d: - publishable directory structure changes (ESM, CJS and UMD included in the output)
  - build system improvements
  - fixed some bundling concerns (https://github.com/nhost/nhost/issues/428)
- Updated dependencies [584976d]
  - @nhost/hasura-auth-js@1.1.5
  - @nhost/hasura-storage-js@0.2.1

## 1.1.9

### Patch Changes

- @nhost/hasura-auth-js@1.1.4

## 1.1.8

### Patch Changes

- Updated dependencies [58fa2a2]
- Updated dependencies [58fa2a2]
  - @nhost/hasura-auth-js@1.1.3

## 1.1.7

### Patch Changes

- b56162a: prefer clientStorage/clientStorageType to clientStorageGetter/clientStorageSetter
- 185f39e: Don't take previous errors into account when using SMS and deanonymisation
  When using the SMS and anonymous signing methods of the Nhost client, the action failed with the client's previous error.
- Updated dependencies [185f39e]
  - @nhost/hasura-auth-js@1.1.2

## 1.1.6

### Patch Changes

- @nhost/hasura-auth-js@1.1.1

## 1.1.5

### Patch Changes

- d49b837: Rename `autoLogin` to `autoSignIn`, and deprecate `autoLogin`
  Thourought Nhost, we use the term `sign in` rather than `login`. This version reflect this terminology in the `NhostClient` options
- Updated dependencies [d49b837]
  - @nhost/hasura-auth-js@1.1.0

## 1.1.4

### Patch Changes

- Updated dependencies [aa1fdf6]
  - @nhost/hasura-auth-js@1.0.15

## 1.1.3

### Patch Changes

- Updated dependencies [e0cfcaf]
  - @nhost/hasura-auth-js@1.0.14

## 1.1.2

### Patch Changes

- @nhost/hasura-auth-js@1.0.13

## 1.1.1

### Patch Changes

- @nhost/hasura-auth-js@1.0.12

## 1.1.0

### Minor Changes

- ccba0b5: Add `graphql-tag` support for GraphQL client
  It is now possible to use a `graphql-tag` argument with `nhost.graphql.request`:

  ```js
  import gql from 'graphql-tag'

  const QUERY = gql`
    query {
      books {
        id
        title
      }
    }
  `

  const { data, error } = await nhost.graphql.request(QUERY)
  ```

### Patch Changes

- ab06e96: Add generic types for NhostFunctionsClient and NhostGraphqlClient request method return type and variables.

## 1.0.11

### Patch Changes

- Updated dependencies [63d6059]
  - @nhost/hasura-auth-js@1.0.11

## 1.0.10

### Patch Changes

- 2c97db6: Keep authentication status and access token in sync
  The authentication events where not set correctly, leading the main Nhost client not to update internal states of storage/graphql/functions sub-clients when using non-react clients.
  The use of private fields (`#`) is also avoided as they conflict with the use of proxies in Vue, leading to errors in the upcoming Vue library.
  Fixes #373 and #378
- Updated dependencies [2c97db6]
  - @nhost/hasura-auth-js@1.0.10

## 1.0.9

### Patch Changes

- Updated dependencies [058956b]
  - @nhost/hasura-auth-js@1.0.9

## 1.0.8

### Patch Changes

- Updated dependencies [6be3758]
  - @nhost/hasura-auth-js@1.0.8

## 1.0.7

### Patch Changes

- @nhost/hasura-auth-js@1.0.5

## 1.0.4

### Patch Changes

- correct dependencies

  See this related issues:

  - [nhost](https://github.com/nhost/nhost/issues/326)
  - [pnpm](https://github.com/pnpm/pnpm/issues/4348)

- Updated dependencies
  - @nhost/hasura-auth-js@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [6eeb9d2]
  - @nhost/hasura-auth-js@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [ab36f90]
  - @nhost/hasura-auth-js@1.0.1

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

- Updated dependencies [744fd69]
  - @nhost/hasura-auth-js@1.0.0
  - @nhost/hasura-storage-js@0.2.0

## 0.3.13

### Patch Changes

- Updated dependencies [ff7ae21]
  - @nhost/hasura-storage-js@0.1.0

## 0.3.12

### Patch Changes

- 8f7643a: Change target ES module build target to es2019
  Some systems based on older versions of Webpack or Babel don't support the current esbuild configuration e.g, [this issue](https://github.com/nhost/nhost/issues/275).
- Updated dependencies [50b9d76]
  - @nhost/hasura-auth-js@0.1.15
  - @nhost/hasura-storage-js@0.0.12

## 0.3.11

### Patch Changes

- Updated dependencies [35f0ee7]
  - @nhost/hasura-storage-js@0.0.11

## 0.3.10

### Patch Changes

- c8f2488: build npm package with esbuild instead of vite. Vite does not build isomorphic packages correctly, in particular the dependency to axios
- Updated dependencies [c8f2488]
  - @nhost/hasura-auth-js@0.1.14
  - @nhost/hasura-storage-js@0.0.10

## 0.3.9

### Patch Changes

- 2e1c055: Axios causes some trouble when used NodeJS / CommonJS. Any code importing `axios` now does so in using the `require()` syntax
- Updated dependencies [2e1c055]
  - @nhost/hasura-auth-js@0.1.13
  - @nhost/hasura-storage-js@0.0.9

## 0.3.8

### Patch Changes

- 03562af: Build in CommonJS and ESM instead of UMD and ESM as the UMD bundle generated by the default Vite lib build mode doesn't work with NodeJS
- Updated dependencies [03562af]
  - @nhost/hasura-auth-js@0.1.12
  - @nhost/hasura-storage-js@0.0.8

## 0.3.7

### Patch Changes

- Updated dependencies [7c3a7be]
  - @nhost/hasura-auth-js@0.1.11
  - @nhost/hasura-storage-js@0.0.7
