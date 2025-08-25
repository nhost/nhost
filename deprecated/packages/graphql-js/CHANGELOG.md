# @nhost/graphql-js

## 0.3.0

### Minor Changes

- d0c9f4c: fix: replace `jose` with `jwt-decode` version 4.0.0

## 0.2.0

### Minor Changes

- 304065a: feat: add `setHeaders` method enabling global configuration of storage, graphql, and functions client headers, alongside added support for passing specific headers with individual calls

## 0.1.9

### Patch Changes

- 7789469: fix: resolve process is undefined error when running with vitejs

## 0.1.8

### Patch Changes

- 407feea: fix: replace `jwt-decode` with `jose` to decode access tokens in a non browser environment

## 0.1.7

### Patch Changes

- 2d68fee: fix: resolve an issue where unauthenticated graphql requests are not sent

## 0.1.6

### Patch Changes

- e0ab6d9: fix: add extra logic to check and wait for a valid JWT

## 0.1.5

### Patch Changes

- 8d91f71: chore: update deps and enable pnpm audit

## 0.1.4

### Patch Changes

- 07a45fde0: chore(deps): bump `graphql` to `v16.7.1`

## 0.1.3

### Patch Changes

- 7fea29a8: fix: update `types` config and fix the exposed React components

## 0.1.2

### Patch Changes

- da03bf39: chore(build): change build target to ES2019

## 0.1.1

### Patch Changes

- 90c60311: chore(deps): add `types` to `package.json`

## 0.1.0

### Minor Changes

- bfb4c1a6: chore(sdk): remove deprecated `useAxios` property

## 0.0.5

### Patch Changes

- 850a049c: chore(deps): update docker/build-push-action action to v4

## 0.0.4

### Patch Changes

- 4bf40995: chore(deps): bump `typescript` to `4.9.5`
- 8bb097c9: chore(deps): bump `vitest`
- 35d52aab: chore(deps): replace `cross-fetch` with `isomorphic-unfetch`

## 0.0.3

### Patch Changes

- 2d9145f9: chore(deps): revert GraphQL client

## 0.0.2

### Patch Changes

- 2200a0ed: Correct type inference on snake case operations
- 3b48a627: Improve readme instructions
