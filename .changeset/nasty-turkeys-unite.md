---
'@nhost/hasura-storage-js': minor
'@nhost/react': minor
---

Extend file upload parameters

- `bucketId` is available everywhere as an option
- It is possible to pass files as a parameter on a multiple `upload`, making the `add` action optional.
- The `add` and `upload` actions of multiple file upload accepts both a `File`, an array of `File` items, and a `FileList`
