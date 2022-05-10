---
'@nhost/core': patch
'@nhost/hasura-auth-js': patch
---

Improve error codes
The errors of `signUp`, `signIn`, `signOut`, and `refreshSession` now always include an `error` field that contains a machine-readable error code.
