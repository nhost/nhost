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

```
yarn add next react react-dom
yarn add @nhost/nextjs graphql
```

React

```
yarn add react react-dom
yarn add @nhost/react graphql
```

Vue

```
yarn add vue
yarn add @nhost/vue graphql
```

React Apollo

```
yarn add react react-dom
yarn add @nhost/react graphql
yarn add @nhost/react-apollo @apollo/client
```

Closes #1335
