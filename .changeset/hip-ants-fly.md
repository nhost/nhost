---
'@nhost/core': patch
---

Accept query parameters from both relative `redirectTo` URLs and the client URL
URLs where malformed When the client URL was defining query parameters and a relative `redirectTo` URL was passed on as an option.
It is now possible to define query parameters in both the base client URL and the relative `redirectTo`
