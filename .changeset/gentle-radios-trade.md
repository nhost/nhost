---
'@nhost/nhost-js': minor
---

Add custom endpoint options to the NhostClient constructor
The `NhostClient` constructor was only accepting a common `backendUrl` for the entire Nhost stack (graphql, auth, storage, functions).
It is now possible to override `backendUrl` with `graphqlUrl`, `authUrl`, `storageUrl`, and `functionsUrl`. They will take precedence over `backendUrl`, but for any of them a value must be given if `backendUrl` is not set.

See the [related issue](https://github.com/nhost/nhost/issues/199)
