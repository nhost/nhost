# @nhost/apollo

## 0.5.25

### Patch Changes

- @nhost/nhost-js@1.4.8

## 0.5.24

### Patch Changes

- 10beea72: Fix React Native build: Export `package.json` for all npm packages.
- Updated dependencies [10beea72]
  - @nhost/nhost-js@1.4.7

## 0.5.23

### Patch Changes

- f30d6779: Bump @apollo/client to v3.6.9

## 0.5.22

### Patch Changes

- @nhost/nhost-js@1.4.6

## 0.5.21

### Patch Changes

- @nhost/nhost-js@1.4.5

## 0.5.20

### Patch Changes

- @nhost/nhost-js@1.4.4

## 0.5.19

### Patch Changes

- @nhost/nhost-js@1.4.3

## 0.5.18

### Patch Changes

- dbc10e62: fixed `exports` field to support imports in a server-side environment
- Updated dependencies [dbc10e62]
  - @nhost/nhost-js@1.4.2

## 0.5.17

### Patch Changes

- Updated dependencies [b8f4b75b]
  - @nhost/nhost-js@1.4.1

## 0.5.16

### Patch Changes

- Updated dependencies [6f0a3005]
  - @nhost/nhost-js@1.4.0

## 0.5.15

### Patch Changes

- Updated dependencies [c1613394]
  - @nhost/nhost-js@1.3.0

## 0.5.14

### Patch Changes

- 8b2d1b00: Add headers to the websocket connection when creating the Apollo client

## 0.5.13

### Patch Changes

- @nhost/nhost-js@1.2.4

## 0.5.12

### Patch Changes

- ebad0936: reverted ESM related changes
- Updated dependencies [ebad0936]
  - @nhost/nhost-js@1.2.3

## 0.5.11

### Patch Changes

- 1b37b9f6: fix: ESM import path fixes
- Updated dependencies [1b37b9f6]
  - @nhost/nhost-js@1.2.2

## 0.5.10

### Patch Changes

- 78341491: fix: Next.js and React issues with ESM packages
  chore: Updated output bundle names
- Updated dependencies [78341491]
  - @nhost/nhost-js@1.2.1

## 0.5.9

### Patch Changes

- bc11c9e5: chore: Changed copy script to support Windows
  fix: Fixed warnings about unknown globals occurring while building the packages
- 2b2f8e91: fix: ESM related issues in Node environments
  chore: Improved the way different formats are exposed via `exports` field in package.js
- Updated dependencies [bc11c9e5]
- Updated dependencies [2b2f8e91]
- Updated dependencies [858014e4]
  - @nhost/nhost-js@1.2.0

## 0.5.8

### Patch Changes

- 097e304f: Import the apollo client from `@apollo/client/core` instead of `@apollo/client`
  It avoids uncessary dependency to React when not using it e.g. Vue when using bundlers that import the library as a whole.

## 0.5.7

### Patch Changes

- Updated dependencies [7c8f0926]
  - @nhost/nhost-js@1.1.14

## 0.5.6

### Patch Changes

- @nhost/nhost-js@1.1.13

## 0.5.5

### Patch Changes

- @nhost/nhost-js@1.1.12

## 0.5.4

### Patch Changes

- Updated dependencies [e094e68]
  - @nhost/nhost-js@1.1.11

## 0.5.3

### Patch Changes

- 584976d: - publishable directory structure changes (ESM, CJS and UMD included in the output)
  - build system improvements
  - fixed some bundling concerns (https://github.com/nhost/nhost/issues/428)
- Updated dependencies [584976d]
  - @nhost/nhost-js@1.1.10

## 0.5.2

### Patch Changes

- Updated dependencies [65a3061]
  - @nhost/core@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [58fa2a2]
- Updated dependencies [58fa2a2]
  - @nhost/core@0.5.1

## 0.5.0

### Minor Changes

- 42edb74: Bump to Apollo client 3.6.2

### Patch Changes

- Updated dependencies [b56162a]
  - @nhost/core@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [7b23d33]
  - @nhost/core@0.4.1

## 0.4.4

### Patch Changes

- b52b4fc: Bump xstate to latest version (`4.31.0`)
- Updated dependencies [b52b4fc]
  - @nhost/core@0.4.0

## 0.4.3

### Patch Changes

- Updated dependencies [7b7527a]
  - @nhost/core@0.3.13

## 0.4.2

### Patch Changes

- Updated dependencies [58e1485]
  - @nhost/core@0.3.12

## 0.4.1

### Patch Changes

- Updated dependencies [0b1cb62]
  - @nhost/core@0.3.11

## 0.4.0

### Minor Changes

- f6093a6: Use graphql-ws instead of subscriptions-transport-ws

## 0.3.9

### Patch Changes

- Updated dependencies [63d6059]
  - @nhost/core@0.3.10

## 0.3.8

### Patch Changes

- Updated dependencies [2c97db6]
  - @nhost/core@0.3.9

## 0.3.7

### Patch Changes

- Updated dependencies [7cf875f]
  - @nhost/core@0.3.8

## 0.3.5

### Patch Changes

- Updated dependencies [16a6c50]
  - @nhost/core@0.3.4

## 0.3.3

### Patch Changes

- correct dependencies

  See this related issues:

  - [nhost](https://github.com/nhost/nhost/issues/326)
  - [pnpm](https://github.com/pnpm/pnpm/issues/4348)

- Updated dependencies
  - @nhost/core@0.3.2

## 0.3.1

### Patch Changes

- 113beed: fix: Refetched queries and leaking subscriptions [#301](https://github.com/nhost/nhost/issues/301)
- Updated dependencies [4420c0e]
  - @nhost/core@0.3.1

## 0.3.0

### Minor Changes

- 744fd69: Unify vanilla, react and next APIs so they can work together
  React and NextJS libraries now works together with `@nhost/nhost-js`. It also means the Nhost client needs to be initiated before passing it to the React provider.
  See the [React](https://docs.nhost.io/reference/react#configuration) and [NextJS](https://docs.nhost.io/reference/nextjs/configuration) configuration documentation for additional information.

### Patch Changes

- Updated dependencies [744fd69]
  - @nhost/core@0.3.0

## 0.2.1

### Patch Changes

- 0d8afde: Bump xstate version 4.30.5
- Updated dependencies [0d8afde]
  - @nhost/client@0.2.1

## 0.2.0

### Minor Changes

- 207ae38: Rewrite of the Apollo GraphQL client

  - Introducing a new `@nhost/apollo` that will be reusable by other frameworks than React e.g. Vue
  - The new package works together with the `@nhost/client` and its new state management system
  - **BREACKING CHANGE** The react client `@nhost/react-apollo` is set to use the new `@nhost/client` package and won't work anymore with `@nhost/nhost-js`. See the [documentation](https://docs.nhost.io/reference/react/apollo) for further information.

  Closes [#8](https://github.com/nhost/nhost/issues/8)

### Patch Changes

- Updated dependencies [207ae38]
  - @nhost/client@0.2.0
