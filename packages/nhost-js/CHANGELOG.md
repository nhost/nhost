# @nhost/nhost-js

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
