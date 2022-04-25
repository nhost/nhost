---
'@nhost/hasura-auth-js': patch
'@nhost/nhost-js': patch
---

Rename `autoLogin` to `autoSignIn`, and deprecate `autoLogin`
Thourought Nhost, we use the term `sign in` rather than `login`. This version reflect this terminology in the `NhostClient` options
