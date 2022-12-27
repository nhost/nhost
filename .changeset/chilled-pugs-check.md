---
'hasura-auth': minor
---

Stop sending the refresh token in the hash part of the redirection

[Since 9 months](https://github.com/nhost/hasura-auth/pull/146),
Originally, hasura-auth was adding the refresh token to the hash part of the redirection urls, but we decided to add it to the query parameters, as the hash was not accessible in SSR pages.
We decided to add the refresh token in both places during a transition period in order to prevent a breaking change with legacy versions of the SDK, that were looking for the refresh token in the hash.
However, since `@nhost/nhostjs@1.1.4` (April), the SDK also finds (and removes) the refresh token in both places.

Sending the refresh in the hash has a significant impact on Vue users, as the vue-router is handling routes in the hash part of the url in its own way that conflicts with the urls sent by hasura-auth.

This is a breaking change for clients using previous versions of the SDK, or manually looking for the refresh token in the hash instead of the query parameter
