---
'@nhost/nextjs': patch
---

Capture the Nextjs/xstate warning about useLayoutEffect
When using Xstate on the server side, Nextjs raises a warning about the use of `useLayoutEffect` whereas xstate is actually using an isomorphic version of layout effects. Such warnings are now captured.
