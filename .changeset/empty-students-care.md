---
'@nhost/nextjs': patch
'@nhost/react': patch
---

Return an error when trying sign to in/up/out from hooks while in the wrong authentication status
The actions of the authentication hooks were not resolving the promise when executed from the wrong authentication status.
They now return an error.
