---
'@nhost/react': minor
'@nhost/vue': minor
'@nhost/core': patch
---

`sendMfaOtp` now returns a promise
When using `useSignInEmailPassword`, the `sendMfaOtp` was `void`. It now returns a promise that resolves when the server returned the result of the OTP code submission, and returns `isSuccess`, `isError`, and `error`.
