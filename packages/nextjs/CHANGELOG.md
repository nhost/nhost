# @nhost/nextjs

## 0.2.0

### Minor Changes

- 207ae38: New NextJS client

  Introducting a new `@nhost/nextjs` package. It is designed to keep the refresh token between the browser and the Next.js server with a cookie. SSR routes should fetch the session in `getServerSideProps` into a `nhostSession` pageProps in using the `getNhostSession` method.

  Every `@nhost/react` hook is compatible with this package.

  See the [documentation](https://docs.nhost.io/reference/nextjs) for further information.

  Closes [#110](https://github.com/nhost/nhost/issues/110) and [#180](https://github.com/nhost/nhost/issues/180)

### Patch Changes

- Updated dependencies [207ae38]
- Updated dependencies [207ae38]
- Updated dependencies [207ae38]
- Updated dependencies [207ae38]
- Updated dependencies [207ae38]
  - @nhost/client@0.2.0
  - @nhost/react@0.2.0
