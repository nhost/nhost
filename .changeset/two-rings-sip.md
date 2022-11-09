---
'@nhost/nhost-js': minor
---

1. Add custom endpoint options to the NhostClient constructor. `authUrl`, `storageUrl`, `functionsUrl`, and `graphqlUrl` can now be passed as parameters to define the endpoints for each client. These are useful when self hosting. 
2. Fix support for using NhostClient in the context of the CLI and node (e.g. functions).
