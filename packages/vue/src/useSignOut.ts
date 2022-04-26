import { unref } from 'vue'

import { useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Sign the current user out
 */
export const useSignOut = () => {
  const service = useAuthInterpreter()
  const signOut = (
    /** Sign out on all devices */
    all?: RefOrValue<boolean | undefined>
  ) =>
    new Promise<{ isSuccess: boolean }>((resolve) => {
      service.value.send({ type: 'SIGNOUT', all: unref(all) })
      service.value.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'success' } })) {
          resolve({ isSuccess: true })
        } else if (state.matches({ authentication: { signedOut: { failed: 'server' } } }))
          resolve({ isSuccess: false })
      })
    })

  const isSuccess = useSelector(service.value, (state) =>
    state.matches({ authentication: { signedOut: 'success' } })
  )
  return { signOut, isSuccess }
}
