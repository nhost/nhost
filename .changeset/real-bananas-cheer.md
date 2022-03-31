---
'@nhost/core': patch
---

Check if `window.location` exists

When using [Expo](https://expo.dev/), `window` can be an object while `window.location` is `undefined`. It lead to [this issue](https://github.com/nhost/nhost/issues/309).
