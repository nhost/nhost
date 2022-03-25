---
'@nhost/apollo': minor
'@nhost/core': minor
'@nhost/hasura-auth-js': minor
'@nhost/hasura-storage-js': minor
'@nhost/nextjs': minor
'@nhost/nhost-js': minor
'@nhost/react': minor
'@nhost/react-auth': minor
'@nhost/react-apollo': minor
---

Unify vanilla, react and next APIs so they can work together
React and NextJS libraries now works together with `@nhost/nhost-js`. It also means the Nhost client needs to be initiated before passing it to the React provider.
See the [React](https://docs.nhost.io/reference/react#configuration) and [NextJS](https://docs.nhost.io/reference/nextjs/configuration) configuration documentation for additional information.
