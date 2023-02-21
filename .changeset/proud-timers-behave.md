---
'@nhost/hasura-auth-js': major
---

Remove the deprecated `autoLogin` option

Use `autoSignIn` instead:

```ts
const nhost = new NhostClient({ autoSignIn: true })
```
