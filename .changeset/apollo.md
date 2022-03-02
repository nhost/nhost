---
'@nhost/react-apollo': major
'@nhost/apollo': minor
---

Rewrite of the Apollo GraphQL client

- Introducing a new `@nhost/apollo` that will be reusable by other frameworks than React e.g. Vue
- The new package works together with the `@nhost/client` and its new state management system
- **BREACKING CHANGE** The react client `@nhost/react-apollo` is set to use the new `@nhost/client` package and won't work anymore with `@nhost/nhost-js`. See the [documentation](https://docs.nhost.io/reference/react/apollo) for further information.

Closes [#8](https://github.com/nhost/nhost/issues/8)
