# @nhost/vue

## 0.1.2

### Patch Changes

- bc11c9e5: chore: Changed copy script to support Windows
  fix: Fixed warnings about unknown globals occurring while building the packages
- 2b2f8e91: fix: ESM related issues in Node environments
  chore: Improved the way different formats are exposed via `exports` field in package.js
- Updated dependencies [bc11c9e5]
- Updated dependencies [2b2f8e91]
- Updated dependencies [858014e4]
  - @nhost/core@0.6.1
  - @nhost/nhost-js@1.2.0

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
