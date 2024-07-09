---
'@nhost/hasura-auth-js': patch
---

fix: refactor refreshTimer logic to avoid an infinite loop when refreshToken has expired
