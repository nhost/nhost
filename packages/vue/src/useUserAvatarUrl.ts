import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * @returns `Ref` to the avatar url
 */
export const useUserAvatarUrl = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.avatarUrl,
    (a, b) => a === b
  )
}
