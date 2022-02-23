---
'@nhost/hasura-auth-js': patch
'@nhost/hasura-storage-js': patch
'@nhost/nhost-js': patch
---

build npm package with esbuild instead of vite. Vite does not build isomorphic packages correctly, in particular the dependency to axios
