# @nhost-examples/react-apollo

## 0.1.0

### Minor Changes

- 739a3c45: Sign up with an email and a security key.

  Use the hook `useSignUpEmailSecurityKey` to sign up a user with security key and an email using the WebAuthn API.

  ```tsx
  const {
    signUpEmailSecurityKey,
    needsEmailVerification,
    isLoading,
    isSuccess,
    isError,
    error
  } = useSignUpEmailSecurityKey()

  console.log({ needsEmailVerification, isLoading, isSuccess, isError, error })

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    await signUpEmailSecurityKey('joe@example.com')
  }
  ```

### Patch Changes

- Updated dependencies [739a3c45]
- Updated dependencies [74758f2c]
  - @nhost/react@0.13.0
  - @nhost/react-apollo@5.0.0
