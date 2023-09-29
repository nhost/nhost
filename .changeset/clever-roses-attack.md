---
'@nhost/hasura-storage-js': patch
---

- accept FormData exported from [`form-data`](https://www.npmjs.com/package/form-data) as LegacyFormData
- accept native FormData available on node18 and above
- call native fetch available on node18 and above when running on [EdgeRuntime](https://edge-runtime.vercel.app/)
