# @nhost/vue

## 0.1.0

### Minor Changes

- 7c8f0926: new `@nhost/vue` library
  This package brings a similar logic as `@nhost/react` and `@nhost/nextjs` to the Vue 3 framework. It comes with an Nhost client that is installed as a Vue plugin, composables, and integration with `vue-router` and `vue-apollo`.

### Patch Changes

- 7c8f0926: use the [same methods and typings](https://github.com/nhost/nhost/tree/feat/vue/packages/core/src/promises) to interact with xstate machines in both `@nhost/hasura-auth-js`, `@nhost/react` hooks and `@nhost/vue` composables
  Both `@nhost/react`, `@nhost/hasura-auth-js` and `@nhost/vue` interact with the authentication state in a similar way. As a result, the same code was repeated three times, with risks of insonsistency and difficult maintainability. `@nhost/core` now contains the logic and Typescript interfaces that are used in the Vanilla client, React hooks and Vue composables.
- Updated dependencies [7c8f0926]
- Updated dependencies [7c8f0926]
- Updated dependencies [7c8f0926]
  - @nhost/core@0.6.0
  - @nhost/nhost-js@1.1.14
