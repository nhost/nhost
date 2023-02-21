---
'@nhost/hasura-auth-js': major
---

Remove the deprecated `AuthCookieClient` and `AuthClientSSR` constructors

Use the `clientStorageType` option instead:

```ts
const nhost = new NhostClient({ clientStorageType: 'cookie' })
```
