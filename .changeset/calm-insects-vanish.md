---
'@nhost/core': patch
'@nhost/hasura-auth-js': patch
---

fix and improve `nhost.auth.refreshSession`
`nhost.auth.refreshSession` is now functional and returns possible errors, or the user session if the token has been sucessfully refreshed.
If the user was previously not authenticated, it will sign them in. See [#286](https://github.com/nhost/nhost/issues/286)
