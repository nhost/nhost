---
'@nhost/react': minor
'@nhost/vue': minor
---

Introduce `useSignInSmsPasswordless`

```ts
const { signInSmsPasswordless, sendOtp, needsOtp, isLoading, isSuccess, isError, error } =
  useSignInSmsPasswordless()
```

1. The `signInSmsPasswordless` action will send a one-time password to the given phone number.
2. The client is then awaiting the OTP. `needsOtp` is set to true
3. After the code is received by SMS, the client sends the code with `sendOtp`. On success, the client is authenticated, and `isSuccess` equals `true`.

Any error is monitored through `isError` and `error`. While the `signInSmsPasswordless` and `sendOtp` actions are running, `isLoading` equals `true`
