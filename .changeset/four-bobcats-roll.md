---
'@nhost/core': patch
'@nhost/hasura-auth-js': patch
---

Correct `nhost.auth.signIn` to allow anonymous sign-in
The typings were not allowing empty or undefined parameters to let users sign in anonymously. `nhost.auth.signIn()` now triggers an anonymous sign-in.
