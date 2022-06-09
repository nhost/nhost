---
'@nhost/core': minor
'@nhost/nhost-js': minor
'@nhost/react': minor
'@nhost/nextjs': minor
'@nhost/vue': minor
---

Deanonymisation
Once signed in anonymously, users can deanonymise using `nhost.auth.deanonymize`. 
Deanonymisation works the same way as email+password sign-up or passwordless sign-in. The related methods, hooks in React and composables in Vue can therefore be used for deanonymising users, such as `nhost.auth.signUp`, `useSignUpEmailPassword`, and `useSignInEmailPasswordless`.
