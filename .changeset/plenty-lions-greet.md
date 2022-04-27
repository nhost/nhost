---
'@nhost/core': minor
'@nhost/nextjs': minor
'@nhost/react': minor
---

Look for the refresh token both in the query parameters and in the url
Until now, after redirecting from an email, Hasura-auth puts refresh tokens in the hash part of the url. It is a problem when using SSR as the hash is not accessible to the server. This behaviour is likely to change. As a result, the client now parses both the hash and the query parameters of the url.
See [this issue](https://github.com/nhost/hasura-auth/issues/148) to keep track of the progress on Hasura-auth.
