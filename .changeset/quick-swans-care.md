---
'@nhost/nextjs': patch
---

Get the refresh token in the right place in the url
Hasura-auth puts the refresh token in the url as `refreshToken`, but it is not stored using the same key in localStorage / the cookie. This fix makes the right correspondance between the two.
