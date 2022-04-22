---
'@nhost/core': patch
'@nhost/hasura-auth-js': patch
---

Ensure the session is destroyed when signout is done
The user session, in particular the access token (JWT), was still available after sign out.
Any information about user session is now removed from the auth state as soon as the sign out action is called.
