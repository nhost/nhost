---
'@nhost/hasura-auth-js': minor
'@nhost/nhost-js': minor
---

Sign up with an email and a security key.

```ts
const { error, session } = await nhost.auth.signUp({ email: 'joe@example.com', securityKey: true })

if (error) {
  console.log(error)
} else if (session) {
  console.log(session.user)
} else {
  console.log(
    'You need to verify your email address by clicking the link in the email we sent you.'
  )
}
```
