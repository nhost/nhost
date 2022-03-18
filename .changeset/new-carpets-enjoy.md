---
'@nhost/nextjs': minor
'@nhost/react': minor
---

Introducing `useAnonymousSignIn`

Anonymous Sign-In is a feature that allows users to get a temporary id without attaching yet any personal information such as an email or a passowrd.

Anonymous users can then run GraphQL operations, with a specific `public` role that is distinct from the default `user` role. The anonymous can then "deanonymize" their account at a later stage in attaching the missing registration information and an authentication method.

**Note** Anonymous Sign-In is not available out of the box yet in the [Nhost cloud](https://app.nhost.io/), but will be available in the near future.

**Note 2** The deanonymisation process is not yet available. This is also part of our roadmap.

```js
const { signInAnonymous, isLoading, isSuccess, isError, error } = useAnonymousSignIn()
```

| Name              | Type                                                          | Notes                                                                                                                         |
| ----------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `signInAnonymous` | () => void                                                    | Registers an anonymous user                                                                                                   |
| `isLoading`       | boolean                                                       | Returns `true` when the action is executing, `false` when it finished its execution.                                          |
| `isSuccess`       | boolean                                                       | Returns `true` if the sign-up suceeded. Returns `false` if the new email needs to be verified first, or if an error occurred. |
| `isError`         | boolean                                                       | Returns `true` if an error occurred.                                                                                          |
| `error`           | {status: number, error: string, message: string} \| undefined | Provides details about the error.                                                                                             |

#### Usage

```jsx
import { useAnonymousSignIn } from '@nhost/react'

const Component = () => {
  const { signInAnonymous, isSuccess } = useAnonymousSignIn(email, password)
  return (
    <div>
      <button onClick={signInAnonymous}>Anonymous sign-in</button>
      {isSuccess && <div>You are now signed in anonymously</div>}
    </div>
  )
}
```
