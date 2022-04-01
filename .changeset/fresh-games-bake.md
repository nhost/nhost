---
'@nhost/hasura-auth-js': patch
---

Wait for the authentication status to be known before executing auth actions
The auth client was able to start actions such as signUp or signIn before the authentication state was ready (e.g. before initial refresh token could be processed).
This patch solves the problem in waiting for the authentication status to be known before running these actions.
