---
'@nhost/core': patch
'@nhost/hasura-auth-js': patch
'@nhost/nhost-js': patch
---

Keep authentication status and access token in sync
The authentication events where not set correctly, leading the main Nhost client not to update internal states of storage/graphql/functions sub-clients when using non-react clients.
The use of private fields (`#`) is also avoided as they conflict with the use of proxies in Vue, leading to errors in the upcoming Vue library.
Fixes #373 and #378
