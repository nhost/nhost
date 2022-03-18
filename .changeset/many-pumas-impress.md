---
'@nhost/nextjs': minor
'@nhost/react': minor
---

Rename hooks and their methods to make them more explicit

- `useEmailPasswordlessSignIn`
  - Hook renamed to `useSignInEmailPasswordless`
  - `signIn` renamed to `signInEmailPasswordless`
- `useEmailPasswordSignIn`

  - Hook renamed to `useSignInEmailPassword`
  - `signIn` renamed to `signInEmailPassword`
  - `needsVerification` renamed to `needsEmailVerification`

- `useEmailPasswordSignUp`

  - Hook renamed to `useSignUpEmailPassword`
  - `signUp` renamed to `signUpEmailPassword`
  - `needsVerification` renamed to `needsEmailVerification`

- `useAnonymousSignIn`

  - Hook renamed to `useSignInAnonymous`
  - renamed `signIn` to `signInAnonymous`

- `useChangeEmail`

  - `needsVerification` renamed to `needsEmailVerification`
