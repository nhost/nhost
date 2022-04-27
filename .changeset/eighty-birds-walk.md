---
'@nhost/core': patch
---

Improve startup
When `autoSignin` was active, the client was fetching the refresh token twice on startup. This behaviour has been corrected.
