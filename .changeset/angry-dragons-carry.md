---
'@nhost/react': minor
'@nhost-examples/react-apollo': minor
---

Sign up with an email and a security key.

Use the hook `useSignUpEmailSecurityKey` to sign up a user with security key and an email using the WebAuthn API.

```tsx
const { signUpSecurityKey, needsEmailVerification, isLoading, isSuccess, isError, error } =
  useSignUpEmailSecurityKey()

console.log({ needsEmailVerification, isLoading, isSuccess, isError, error })

const handleFormSubmit = async (e) => {
  e.preventDefault()
  await signUpSecurityKey('joe@example.com')
}
```
