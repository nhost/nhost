# @nhost-examples/react-apollo

## 0.1.5

### Patch Changes

- 85683547: Allow `useFileUpload` to be reused
  Once a file were uploaded with `useFileUpload`, it was not possible to reuse it as the returned file id were kept in memory and sent again to hasura-storage, leading to a conflict error.
  File upload now makes sure to clear the metadata information from the first file before uploading the second file.
- Updated dependencies [1be6d324]
- Updated dependencies [2e8f73df]
- Updated dependencies [85683547]
  - @nhost/react@1.12.1
  - @nhost/react-apollo@4.12.1

## 0.1.4

### Patch Changes

- b21222b3: chore(deps): update dependency @types/node to v16
- Updated dependencies [b21222b3]
- Updated dependencies [54df0df4]
- Updated dependencies [54df0df4]
- Updated dependencies [65687bee]
  - @nhost/react@1.12.0
  - @nhost/react-apollo@4.12.0

## 0.1.3

### Patch Changes

- 7f251111: Use `NhostProvider` instead of `NhostReactProvider` and `NhostNextProvider`

  `NhostReactProvider` and `NhostNextProvider` are now deprecated

- Updated dependencies [7f251111]
  - @nhost/react@0.16.0
  - @nhost/react-apollo@4.10.0

## 0.1.2

### Patch Changes

- 132a4f4b: chore(deps): synchronize @types/react-dom and @types/react versions
- Updated dependencies [132a4f4b]
  - @nhost/react@0.15.2
  - @nhost/react-apollo@4.9.2

## 0.1.1

### Patch Changes

- ba785da1: Bump dependencies versions
- Updated dependencies [ba785da1]
- Updated dependencies [6da44bf8]
  - @nhost/react@0.14.0
  - @nhost/react-apollo@4.10.0

## 0.1.0

### Minor Changes

- 739a3c45: Sign up with an email and a security key.

  Use the hook `useSignUpEmailSecurityKey` to sign up a user with security key and an email using the WebAuthn API.

  ```tsx
  const { signUpEmailSecurityKey, needsEmailVerification, isLoading, isSuccess, isError, error } =
    useSignUpEmailSecurityKey()

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
  - @nhost/react-apollo@4.12.0
