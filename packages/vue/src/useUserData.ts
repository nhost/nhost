import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * User data
 * @example
```js
const {
  id,
  email,
  displayName,
  avatarUrl,
  isAnonymous,
  locale,
  defaultRole,
  roles,
  metadata,
  createdAt,
} = useUserData();
```
 * 
 * @example Example of an authenticated user
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
 */
export const useUserData = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user,
    (a, b) => JSON.stringify(a) === JSON.stringify(b)
  )
}
