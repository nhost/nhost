---
'@nhost/nextjs': patch
---

Fix `createServerSideClient`

The refresh token was not fetched from the cookie when using `createServerSideClient` since [this PR](https://github.com/nhost/nhost/pull/823).
It is now fixed.
