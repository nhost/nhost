---
'@nhost/hasura-storage-js': patch
---

Rename `storage.getUrl` to `storage.getPublicUrl`
It aims to make a clear distinction between `storage.getPublicUrl` and `storage.getPresginedUrl`
`storage.getUrl` is now deprecated.
