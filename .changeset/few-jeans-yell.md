---
'@nhost/core': minor
'@nhost/react': minor
---

Remove `refreshToken` from the url when `autoSignIn` is set
On startup, when the `autoSignIn` option is set to `true`, the client now removes it from the URL when the page loads.
