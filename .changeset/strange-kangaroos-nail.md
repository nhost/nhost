---
'@nhost/react': patch
---

Ensure the session is destroyed when signout is done
In the `useSignOut` hook, `signOut` now returns a promise. We are now sure the user session is empty once the promise is resolved.
