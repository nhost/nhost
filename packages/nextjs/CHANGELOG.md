# @nhost/nextjs

## 0.3.1

### Patch Changes

- 9bd01e7: Export refresh function

## 0.3.0

### Minor Changes

- 0d8afde: Use `@nhost/react` as a peer dependency
  `@nhost/react` was bundled where it shouldn't. As a result, `@nhost/react-apollo` did not have access to the Nhost React context, leading to errors

### Patch Changes

- 0d8afde: Bump xstate version 4.30.5
- 0d8afde: Capture the Nextjs/xstate warning about useLayoutEffect
  When using Xstate on the server side, Nextjs raises a warning about the use of `useLayoutEffect` whereas xstate is actually using an isomorphic version of layout effects. Such warnings are now captured.
- Updated dependencies [0d8afde]
  - @nhost/react@0.2.1

## 0.2.0

### Minor Changes

- 207ae38: New NextJS client

  Introducting a new `@nhost/nextjs` package. It is designed to keep the refresh token between the browser and the Next.js server with a cookie. SSR routes should fetch the session in `getServerSideProps` into a `nhostSession` pageProps in using the `getNhostSession` method.

  Every `@nhost/react` hook is compatible with this package.

  See the [documentation](https://docs.nhost.io/reference/nextjs) for further information.

  Closes [#110](https://github.com/nhost/nhost/issues/110) and [#180](https://github.com/nhost/nhost/issues/180)

### Patch Changes

- Updated dependencies [207ae38]
  - @nhost/client@0.2.0
  - @nhost/react@0.2.0
