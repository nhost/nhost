---
'@nhost/react': minor
---

Deprecate `useAuthLoading` and introduce `useAuthenticationStatus`
When using both `useAuthLoading` and `useAuthenticated` together, the hooks rerender independently from each other.
As a result, when a user loads the page while he previously authenticated, the hooks values were chronologically:

| isLoading | isAuthenticated |
| --------- | --------------- |
| `true`    | `false`         |
| `false`   | `false`         |
| `false`   | `true`          |

The interpediate (`false`, `false`) is incorrect and is causing issues when using an authentication gate.

It is therefore recommended to stop using `useAuthLoading`, and to use `useAuthenticationStatus` instead, in order to keep the loading state and the authentication in sync within the same hook.

Usage:

```js
const { isLoading, isAuthenticated } = useAuthenticationStatus()
```

Fixes [this issue](https://github.com/nhost/nhost/issues/302)
