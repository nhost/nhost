---
'@nhost/react': patch
---

add the `mfa` ticket to `useSignInEmailPassword`
The `useSignInEmailPassword` hook was not returning the MFA ticket. This releases fixes the issue.
