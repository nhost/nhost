---
'@nhost/react': major
---

Remove deprecated hooks

- `useNhostAuth`: use `useNhostClient` instead
- `useAuthLoading`: use `useAuthenticationStatus` instead
- `useAvatarUrl`: use `useUserAvatarUrl` instead.
- `useDefaultRole`: use `useUserDefaultRole` instead.
- `useDisplayName`: use `useUserDisplayName` instead.
- `useEmail`: use `useUserEmail` instead.
- `useIsAnonymous`: use `useUserIsAnonymous` instead.
- `useNhostBackendUrl`: use `useNhostClient` instead, then the urls in the respective `nhost.<auth,storage,graphql,functions>` clients
