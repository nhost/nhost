---
'@nhost/core': minor
---

Retry the token import when starting offline
When using auto-sign-in and the user client stored a refresh token, it now retries to get an access token from the server until the server can be reached and did not return an internal error.
The five first attempts occur every second, then occur every five seconds.

When offline, it means `nhost.auth.isAuthenticatedAsync()` won't resolve until the user is online. In that case, use a conjunction of `nhost.auth.getAuthenticationStatus()` and `nhost.auth.onAuthStateChanged`.
