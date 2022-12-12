---
'@nhost/nextjs': minor
---

Remove `@nhost/react` from `peerDepencencies`

The contents of the `@nhost/react` package are now exported by `@nhost/nextjs`. As a result,
It is not required to install `@nhost/react` alongside `@nhost/nextjs`.

Before:

```
yarn add @nhost/react @nhost/nextjs graphql
```

After:

```
yarn add @nhost/nextjs graphql
```

Closes [#1335](https://github.com/nhost/nhost/issues/1335)
