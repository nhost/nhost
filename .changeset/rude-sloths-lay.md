---
'@nhost-examples/react-apollo': patch
'@nhost/hasura-storage-js': patch
'@nhost/react': patch
'@nhost/vue': patch
---

Allow `useFileUpload` to be reused
Once a file were uploaded with `useFileUpload`, it was not possible to reuse it as the returned file id were kept in memory and sent again to hasura-storage, leading to a conflict error.
File upload now makes sure to clear the metadata information from the first file before uploading the second file.
