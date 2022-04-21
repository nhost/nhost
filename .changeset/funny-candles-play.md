---
'@nhost/core': patch
---

Use native `BroadcastChannel` instead of the `broadcast-channel` package
The `broadcast-channel` depends on `node-gyp-build`, which can cause issues when deploying on Vercel as it is a native dependency.
The added value of `broadcast-channel` is to be able to communicate the change of authentication state accross processes in a NodeJs / Electron environment, but this is considered an edge case for now.
See [Vercel official documentation](https://vercel.com/support/articles/why-does-my-serverless-function-work-locally-but-not-when-deployed#native-dependencies).
