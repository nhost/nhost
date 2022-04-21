# @nhost/apollo

## 0.4.2

### Patch Changes

- Updated dependencies [7b5f00d]
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
- Updated dependencies [63d6059]
  - @nhost/core@0.3.10

## 0.3.8

### Patch Changes

- Updated dependencies [2c97db6]
  - @nhost/core@0.3.9

## 0.3.7

### Patch Changes

- Updated dependencies [058956b]
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
