---
'@nhost/hasura-auth-js': minor
'@nhost/nhost-js': minor
---

Complete sign-in when email+password MFA is activated
It was not possible to complete authentication with `nhost.auth.signIn` in sending the TOTP code when email+password MFA was activated.
An user that activated MFA can now sign in with the two following steps:
```js
await nhost.auth.signIn({ email: 'email@domain.com', password: 'not-my-birthday' })
// Get the one-time password with an OTP application e.g. Google Authenticator
await nhost.auth.signIn({ otp: '123456' })
```
