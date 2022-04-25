import { unref } from 'vue'

import { useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useAuthInterpreter } from './useAuthInterpreter'

export const useSignOut = () => {
  const service = useAuthInterpreter()
  const signOut = (all?: RefOrValue<boolean | undefined>) =>
    service.value.send({
      type: 'SIGNOUT',
      all: unref(all)
    })
  const isSuccess = useSelector(service.value, (state) =>
    state.matches({ authentication: { signedOut: 'success' } })
  )
  // ? In React:
  //  const isSuccess = !!service.value.status && service.state.matches({ authentication: { signedOut: 'success' } })
  return { signOut, isSuccess }
}
