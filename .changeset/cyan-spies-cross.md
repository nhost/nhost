---
'@nhost/core': patch
'@nhost/hasura-auth-js': patch
'@nhost/nextjs': patch
'@nhost/react': patch
---

Improve loading status
The `loading` status indicates the authentication is not yet known to the client when it starts. Once the client is ready, the authentication status is either signed in, or signed out.
When the user was trying to authenticate, the `loading` status was set to `true` until the result of the authentication was known.
The client now only return `loading: true` on startup, and in no other cases.
