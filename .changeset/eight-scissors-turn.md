---
'@nhost/hasura-auth-js': patch
'@nhost/hasura-storage-js': patch
'@nhost/nhost-js': patch
---

Change target ES module build target to es2019
Some systems based on older versions of Webpack or Babel don't support the current esbuild configuration e.g, [this issue](https://github.com/nhost/nhost/issues/275).