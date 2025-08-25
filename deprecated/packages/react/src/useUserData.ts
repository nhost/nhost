import { User } from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the hook `useUserData` to get the user data of the user.
 *
 * @example
 * ```tsx
 * const userData = useUserData();
 * ```
 * 
   * @example Example of user data
```json
{
  "avatarUrl": "https://s.gravatar.com/avatar",
  "createdAt": "2022-04-11T16:33:14.780439+00:00",
  "defaultRole": "user",
  "displayName": "John Doe",
  "email": "john@nhost.io",
  "id": "05e054c7-a722-42e7-90a6-3f77a2f118c8",
  "isAnonymous": false,
  "locale": "en",
  "metadata": {
    "lastName": "Doe",
    "firstName": "John"
  },
  "roles": ["user", "me"]
}
```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-data
 */
export const useUserData = (): User | null => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user,
    (a, b) => (a && JSON.stringify(a)) === (b && JSON.stringify(b))
  )
}
