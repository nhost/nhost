---
'@nhost/nextjs': minor
'@nhost/react': minor
---

Add options to `useProviderLink`

Since [Hasura Auth version 0.4](https://github.com/nhost/hasura-auth/releases/tag/v0.4.0), it is possible to pass on options when signing up or signin in through an OAuth provider. It is now possible to determine these options in the `useProviderLink`, so it generates the right URL when using the provider links.

See the [React documentation](https://docs.nhost.io/reference/react/hooks#oauth-providers) for additional information.
