import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the hook `useUserAvatarUrl` to get the avatar URL of the user.
 *
 * @example
 * ```tsx
 * const userAvatarUrl = useUserAvatarUrl();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-avatar-url
 */
export const useUserAvatarUrl = (): string | undefined => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.avatarUrl,
    (a, b) => a === b
  )
}
