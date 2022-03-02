---
'@nhost/react': minor
---

New React client

This release brings a full rewrite of the React client, to make it tree shakable and fully reactive.
See the [documentation](https://docs.nhost.io/reference/react) for further information.

### Hooks

- `useAccessToken`
- `useAnonymousSignIn`
- `useAuthenticated`
- `useAvatarUrl`
- `useChangeEmail`
- `useChangePassword`
- `useDefaultRole`
- `useDisplayName`
- `useEmail`
- `useEmailPasswordlessSignIn`
- `useEmailPasswordSignIn`
- `useEmailPasswordSignUp`
- `useIsAnonymous`
- `useAuthLoading`
- `useNhost`
- `useNhostBackendUrl`
- `useNhostInterpreter`
- `useResetPassord`
- `useSignOut`
- `useUserData`
- `useUserId`
- `useUserLocale`
- `useUserRoles`
- the `useNhostAuth` has not been included. Use `useAuthenticated` together with `useAuthLoading` and `useUserData` instead

Closes [#189](https://github.com/nhost/nhost/issues/189), [#127](https://github.com/nhost/nhost/issues/127), [#186](https://github.com/nhost/nhost/issues/186), and [#195](https://github.com/nhost/nhost/issues/195)
