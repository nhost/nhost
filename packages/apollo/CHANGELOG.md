# @nhost/apollo

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
