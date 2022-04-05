---
'@nhost/core': patch
'@nhost/hasura-auth-js': patch
---

Add `emailVerified`, `phoneNumber`, `phoneNumberVerified`, and `activeMfaType` to User type

Some information is missing in the `User` payload (see [this issue](https://github.com/nhost/nhost/issues/306)). The above properties have been added in the Typescript `User` type and are available when using Hasura Auth versions from [this pull request](https://github.com/nhost/hasura-auth/pull/128) (tentative version number: `0.5.1`)
