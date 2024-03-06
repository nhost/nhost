# @nhost-examples/react-apollo

## 0.5.0

### Minor Changes

- 08a7dd9: feat: add example workaround to the reset password ticket expired issue

### Patch Changes

- f0a994a: fix: update allowedUrls and redirectTo to point to the profile page

## 0.4.1

### Patch Changes

- 4f3fb34: fix: set redirectTo when doing sign in with github and include vercel previews in allowed redirect URLs

## 0.4.0

### Minor Changes

- 49a80c2: chore: update dependencies

### Patch Changes

- Updated dependencies [49a80c2]
  - @nhost/react-apollo@10.0.0
  - @nhost/react@3.3.0

## 0.3.3

### Patch Changes

- @nhost/react@3.2.3
- @nhost/react-apollo@9.0.3

## 0.3.2

### Patch Changes

- @nhost/react@3.2.2
- @nhost/react-apollo@9.0.2

## 0.3.1

### Patch Changes

- @nhost/react-apollo@9.0.1
- @nhost/react@3.2.1

## 0.3.0

### Minor Changes

- 017f1a6: feat: add elevated permission examples

### Patch Changes

- Updated dependencies [017f1a6]
  - @nhost/react@3.2.0
  - @nhost/react-apollo@9.0.0

## 0.2.1

### Patch Changes

- @nhost/react@3.1.1
- @nhost/react-apollo@8.0.1

## 0.2.0

### Minor Changes

- 1a61c65: feat: add 'elevateEmailSecurityKey' to the SDKs along with integration into react-apollo and vue-apollo examples

### Patch Changes

- e5bab6a: chore: update dependencies
- Updated dependencies [1a61c65]
- Updated dependencies [e5bab6a]
  - @nhost/react@3.1.0
  - @nhost/react-apollo@8.0.0

## 0.1.18

### Patch Changes

- 8d91f71: chore: update deps and enable pnpm audit
- Updated dependencies [8d91f71]
  - @nhost/react-apollo@7.0.2
  - @nhost/react@3.0.2

## 0.1.17

### Patch Changes

- 67b2c044b: feat: add sign-in with Linked-In

## 0.1.16

### Patch Changes

- 6e61dce29: feat: add SignIn with Apple
  - @nhost/react@2.1.1
  - @nhost/react-apollo@6.0.1

## 0.1.15

### Patch Changes

- dba71483d: chore: react-apollo-example: add profile to allowedUrls
- e819903f1: chore: remove facebook login
  - @nhost/react@2.0.30
  - @nhost/react-apollo@5.0.34

## 0.1.14

### Patch Changes

- b3b64a3b7: chore(deps): bump `@types/react` to `v18.2.14` and `@types/react-dom` to `v18.2.6`
- Updated dependencies [b3b64a3b7]
  - @nhost/react-apollo@5.0.29
  - @nhost/react@2.0.25

## 0.1.13

### Patch Changes

- e3001ba4a: fix(examples): don't break E2E tests

## 0.1.12

### Patch Changes

- aa3c62989: chore(cli): bump Nhost CLI version to v1.0
  - @nhost/react@2.0.20
  - @nhost/react-apollo@5.0.24

## 0.1.11

### Patch Changes

- 43b1b144: chore(deps): bump `@types/react` to v18.0.34 and `@types/react-dom` to v18.0.11
- Updated dependencies [43b1b144]
  - @nhost/react-apollo@5.0.17
  - @nhost/react@2.0.14

## 0.1.10

### Patch Changes

- caba147b: chore(examples): improve tests of the React Apollo example

## 0.1.9

### Patch Changes

- 01318860: fix(nhost-js): use correct URL for functions requests
- Updated dependencies [01318860]
  - @nhost/react-apollo@5.0.5
  - @nhost/react@2.0.4

## 0.1.8

### Patch Changes

- 445d8ef4: chore(deps): bump `@nhost/react` to 2.0.3
- 445d8ef4: chore(deps): bump `@nhost/react-apollo` to 5.0.4
- Updated dependencies [445d8ef4]
- Updated dependencies [445d8ef4]
- Updated dependencies [445d8ef4]
  - @nhost/react-apollo@5.0.4
  - @nhost/react@2.0.3

## 0.1.7

### Patch Changes

- 200e9f77: chore(deps): update dependency @types/react-dom to v18.0.10
- Updated dependencies [200e9f77]
  - @nhost/react@1.13.2
  - @nhost/react-apollo@4.13.2

## 0.1.6

### Patch Changes

- c2706c7d: Export commonly used types

  `BackendUrl`, `ErrorPayload`, `NhostSession`, `Subdomain`, and `User` are now exported in all our SDKs

- Updated dependencies [c2706c7d]
- Updated dependencies [d42c27ae]
  - @nhost/react@1.13.1
  - @nhost/react-apollo@4.13.1

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
