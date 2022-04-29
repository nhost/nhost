---
'@nhost/react': patch
---

Rename user data hooks to make them all start with `userUser...`
The hooks that help to access user data were not consistently named.
The following hooks have been therefore renamed:

- `useAvatarUrl` -> `useUserAvatarUrl`
- `useDefaultRole` -> `useUserDefaultRole`
- `useDisplayName` -> `useUserDisplayName`
- `useEmail` -> `useUserEmail`
- `useIsAnonymous` -> `useUserIsAnonymous`

Their former names are still available for backwards compatibility, but are flagged as deprecated.
