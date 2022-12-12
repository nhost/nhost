---
'@nhost/hasura-auth-js': major
'@nhost/nextjs': major
'@nhost/nhost-js': major
'@nhost/react': major
'@nhost/vue': major
---

Remove the deprecated `autoLogin` option

Use `autoSignIn` instead:

```ts
const nhost = new NhostClient({ autoSignIn: true })
```
