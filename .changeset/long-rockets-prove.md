---
'@nhost/react-auth': major
---

Use `@nhost/react` instead of `@nhost/react-auth`
This major release allows to use the latest Nhost authentication state mechanism. It wraps and exports `NhostReactProvider` as `NhostAuthProvider` and `useNhostAuth` from `@nhost/react`.

In order to use it, you need to install `@nhost/react` as it is now a peer dependency:

```
npm install @nhost/react
# or
yarn add @nhost/react
```

It is however recommended to switch to `@nhost/react` and to remove this package from your dependencies.
