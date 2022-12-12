---
'@nhost/hasura-auth-js': major
'@nhost/nextjs': major
'@nhost/nhost-js': major
'@nhost/react': major
'@nhost/vue': major
---

Remove the deprecated `clientStorageGetter` and `clientStorageSetter` options

Use `clientStorageType` and `clientStorage` instead:

```ts
const nhost = new NhostClient({ clientStorageType: 'custom', clientStorage: TODO })
```
