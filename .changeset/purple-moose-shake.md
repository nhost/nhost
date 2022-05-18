---
'@nhost/hasura-auth-js': patch
'@nhost/nhost-js': patch
---

add `devTools` option to the Nhost client
The Nhost client now accepts a `devTools` parameter that can be used to inspect the authentication state machine with [@xstate/inspect](https://xstate.js.org/docs/packages/xstate-inspect/)
