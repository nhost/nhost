---
'@nhost/hasura-auth-js': major
'@nhost/nhost-js': major
---

Use `@nhost/core` and its state machine

`@nhost/nhost-js` and `@nhost/hasura-auth-js` now use the xstate-based state management system from `@nhost/core`.

The client initiation remains the same, although the `clientStorage` and `clientStorageType` are deprecated in favor of `clientStorageGetter (key:string) => string | null | Promise<string | null>` and `clientStorageSetter: (key: string, value: string | null) => void | Promise<void>`.
