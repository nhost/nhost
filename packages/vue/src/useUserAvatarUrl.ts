import { useSelector } from '@xstate/vue'
import { Ref } from 'vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the composable `useUserAvatarUrl` to get the avatar URL of the user.
 *
 * @example
 * ```tsx
 * const userAvatarUrl = useUserAvatarUrl();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-user-avatar-url
 */
export const useUserAvatarUrl = (): Ref<string | undefined> => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.avatarUrl,
    (a, b) => a === b
  )
}
