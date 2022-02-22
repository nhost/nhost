---
'@nhost/hasura-auth-js': patch
'@nhost/hasura-storage-js': patch
'@nhost/nhost-js': patch
---

Axios causes some trouble when used NodeJS / CommonJS. Any code importing `axios` now does so in using the `require()` syntax
