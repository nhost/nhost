---
'@nhost/core': patch
'@nhost/hasura-auth-js': patch
'@nhost/nextjs': patch
'@nhost/react': patch
---

Look for a valid refresh token both the URL and local storage
When auto-signin was activated, the client was not taking into account the refresh token in the URL if a token was already stored locally.
The user was then not able to authenticate from a link when the refresh token stored locally was invalid or expired.
When auto-signin is activated, the client now checks and tries tokens from both the URL and the local storage, starting with the URL.
