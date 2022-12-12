---
'@nhost/hasura-auth-js': major
---

Remove the deprecated `clientStorageGetter` and `clientStorageSetter` options

Use `clientStorageType` and `clientStorage` instead:

```ts
const nhost = new NhostClient({ clientStorageType: 'custom', clientStorage: TODO })
```
