---
'@nhost/vue': patch
---

Fix the deletion of refresh tokens in the URL when autoSignIn is enabled.
This feature only work when using the HTML5 history mode. A warning will appear when using the Hash mode and when in development mode.
