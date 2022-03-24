---
'@nhost/core': patch
---

Rename `@nhost/client` to `@nhost/core`
The `@nhost/client` name was somehow misleading, as it was implying it could somehow work as a vanilla client, whereas it only contained the state machine that could be used for vanilla or framework specific libraries e.g. `@nhost/react`.

It is therefore renamed to `@nhost/core`, and keeps the same versionning and changelog.
