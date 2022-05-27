---
'@nhost/hasura-storage-js': minor
'@nhost/nhost-js': minor
---

New `adminSecret` option
It is now possible to add a new `adminSecret` when creating a Nhost client. When set, it is sent as `x-hasura-admin-secret` header with any GraphQL, Storage or Functions request.