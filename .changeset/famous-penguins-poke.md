---
'@nhost/hasura-storage-js': patch
---

Convert non ISO-8859-1 file names

It is now possible to upload files with names that are not ISO-8859-1 compliant.
In that case, file names will be converted using `encodeURIComponent`.
