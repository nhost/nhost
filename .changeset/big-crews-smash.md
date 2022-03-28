---
'@nhost/hasura-auth-js': patch
---

Correct access to user/session information through getUser/getSession/isReady function when authentication state is not ready yet
In some cases e.g. NextJS build, `auth.getUser()`, `auth.getSession()` or `auth.isReady()` should be accessible without raising an error.
