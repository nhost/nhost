---
'@nhost/hasura-storage-js': major
---

Replace `axios` by `cross-fetch`

`@nhost/hasura-storage-js` now uses `cross-fetch` instead of `axios`.
When in a browser, it uploads files using `XMLHttpRequest` to be able to track upload progress (feature available in React and Vue)

**Breaking Changes**

The error returned in `const { error } = nhost.storage.upload()` is not a JavaScript `Error`, but an object of type `{ error: string; status: number; message: string}`.
