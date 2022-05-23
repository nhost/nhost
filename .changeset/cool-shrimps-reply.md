---
'@nhost/apollo': patch
---

Import the apollo client from `@apollo/client/core` instead of `@apollo/client`
It avoids uncessary dependency to React when not using it e.g. Vue when using bundlers that import the library as a whole.