---
'@nhost/hasura-auth-js': patch
---

fix: resolved infinite loop occurring with requests to /token when a user logs out in one tab while other tabs are open
