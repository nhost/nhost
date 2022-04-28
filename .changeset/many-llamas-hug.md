---
'@nhost/core': minor
---

Capture hasura-auth errors from the url
When using social providers (Oauth) or email links, Hasura-Auth adds potential error codes and messages to the url.
When the Nhost client loads, it now reads these errors and stores them in the authentication state.
