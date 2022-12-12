---
'@nhost/hasura-storage-js': major
---

Replace `axios` by `cross-fetch`

**Breaking Changes**

The error returned in `const { error } = nhost.storage.upload()` is not a JavaScript `Error`, but an object of type `{ error: string; status: number; message: string}`.
