# @nhost/react-auth

## 3.5.1

### Patch Changes

- Updated dependencies [93cc6920]
  - @nhost/hasura-auth-js@1.4.1
  - @nhost/react@0.12.1

## 3.5.0

### Patch Changes

- 10beea72: Fix React Native build: Export `package.json` for all npm packages.
- Updated dependencies [18ac56d0]
- Updated dependencies [10beea72]
- Updated dependencies [84ba29dd]
  - @nhost/hasura-auth-js@1.4.0
  - @nhost/react@0.12.0

## 3.4.2

### Patch Changes

- @nhost/hasura-auth-js@1.3.4
- @nhost/react@0.11.2

## 3.4.1

### Patch Changes

- @nhost/hasura-auth-js@1.3.3
- @nhost/react@0.11.1

## 3.4.0

### Patch Changes

- Updated dependencies [4f928756]
  - @nhost/react@0.11.0

## 3.3.0

### Patch Changes

- Updated dependencies [f9854b15]
- Updated dependencies [f9854b15]
  - @nhost/react@0.10.0
  - @nhost/hasura-auth-js@1.3.2

## 3.2.2

### Patch Changes

- dbc10e62: fixed `exports` field to support imports in a server-side environment
- Updated dependencies [dbc10e62]
  - @nhost/hasura-auth-js@1.3.1
  - @nhost/react@0.9.2

## 3.2.1

### Patch Changes

- @nhost/react@0.9.1

## 3.2.0

### Patch Changes

- Updated dependencies [6f0a3005]
- Updated dependencies [6f0a3005]
  - @nhost/hasura-auth-js@1.3.0
  - @nhost/react@0.9.0

## 3.1.0

### Patch Changes

- Updated dependencies [c1613394]
- Updated dependencies [c1613394]
  - @nhost/react@0.8.0
  - @nhost/hasura-auth-js@1.2.0

## 3.0.11

### Patch Changes

- Updated dependencies [08a37aae]
  - @nhost/react@0.7.13
  - @nhost/hasura-auth-js@1.1.14

## 3.0.10

### Patch Changes

- ebad0936: reverted ESM related changes
- Updated dependencies [ebad0936]
  - @nhost/hasura-auth-js@1.1.13
  - @nhost/react@0.7.12

## 3.0.9

### Patch Changes

- 1b37b9f6: fix: ESM import path fixes
- Updated dependencies [1b37b9f6]
  - @nhost/hasura-auth-js@1.1.12
  - @nhost/react@0.7.11

## 3.0.8

### Patch Changes

- 78341491: fix: Next.js and React issues with ESM packages
  chore: Updated output bundle names
- Updated dependencies [78341491]
  - @nhost/hasura-auth-js@1.1.11
  - @nhost/react@0.7.10

## 3.0.7

### Patch Changes

- bc11c9e5: chore: Changed copy script to support Windows
  fix: Fixed warnings about unknown globals occurring while building the packages
- 2b2f8e91: fix: ESM related issues in Node environments
  chore: Improved the way different formats are exposed via `exports` field in package.js
- Updated dependencies [bc11c9e5]
- Updated dependencies [2b2f8e91]
  - @nhost/hasura-auth-js@1.1.10
  - @nhost/react@0.7.9

## 3.0.6

### Patch Changes

- Updated dependencies [7c8f0926]
- Updated dependencies [7c8f0926]
- Updated dependencies [7c8f0926]
  - @nhost/hasura-auth-js@1.1.9
  - @nhost/react@0.7.8

## 3.0.5

### Patch Changes

- @nhost/hasura-auth-js@1.1.8
- @nhost/react@0.7.7

## 3.0.4

### Patch Changes

- @nhost/hasura-auth-js@1.1.7
- @nhost/react@0.7.6

## 3.0.3

### Patch Changes

- Updated dependencies [9d32314]
- Updated dependencies [9d32314]
- Updated dependencies [236ce72]
- Updated dependencies [e094e68]
- Updated dependencies [236ce72]
  - @nhost/react@0.7.5
  - @nhost/hasura-auth-js@1.1.6

## 3.0.2

### Patch Changes

- Updated dependencies [2887ce0]
  - @nhost/react@0.7.4

## 3.0.1

### Patch Changes

- 584976d: - publishable directory structure changes (ESM, CJS and UMD included in the output)
  - build system improvements
  - fixed some bundling concerns (https://github.com/nhost/nhost/issues/428)
- Updated dependencies [584976d]
  - @nhost/hasura-auth-js@1.1.5
  - @nhost/react@0.7.3

## 3.0.0

### Major Changes

- 744fd69: Use `@nhost/react` instead of `@nhost/react-auth`
  This major release allows to use the latest Nhost authentication state mechanism. It wraps and exports `NhostReactProvider` as `NhostAuthProvider` and `useNhostAuth` from `@nhost/react`.

  In order to use it, you need to install `@nhost/react` as it is now a peer dependency:

  ```
  npm install @nhost/react
  # or
  yarn add @nhost/react
  ```

  It is however recommended to switch to `@nhost/react` and to remove this package from your dependencies.

### Minor Changes

- 744fd69: Unify vanilla, react and next APIs so they can work together
  React and NextJS libraries now works together with `@nhost/nhost-js`. It also means the Nhost client needs to be initiated before passing it to the React provider.
  See the [React](https://docs.nhost.io/reference/react#configuration) and [NextJS](https://docs.nhost.io/reference/nextjs/configuration) configuration documentation for additional information.

## 2.0.11

### Patch Changes

- @nhost/nhost-js@0.3.13

## 2.0.10

### Patch Changes

- Updated dependencies [8f7643a]
  - @nhost/nhost-js@0.3.12

## 2.0.9

### Patch Changes

- @nhost/nhost-js@0.3.11

## 2.0.8

### Patch Changes

- 38f0093: Correct Nhost context type
  `const { user } = useNhostAuth()`: user type was `null`. It is now `User | null`.

## 2.0.7

### Patch Changes

- c8f2488: optimize npm packages: only include the `dist` directory, and introduce the `exports` field in package.json as per Vite's recommendations.
- Updated dependencies [c8f2488]
  - @nhost/nhost-js@0.3.10

## 2.0.6

### Patch Changes

- Updated dependencies [2e1c055]
  - @nhost/nhost-js@0.3.9

## 2.0.5

### Patch Changes

- 03562af: Build in CommonJS and ESM instead of UMD and ESM as the UMD bundle generated by the default Vite lib build mode doesn't work with NodeJS
- Updated dependencies [03562af]
  - @nhost/nhost-js@0.3.8

## 2.0.4

### Patch Changes

- @nhost/nhost-js@0.3.7
