import { computed } from 'vue'

import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

export const useAuthenticationStatus = () => {
  const service = useAuthInterpreter()
  // TODO review this
  const status = useSelector(
    service.value,
    (state) => ({
      isAuthenticated: state.matches({ authentication: 'signedIn' }),
      isLoading: !state.hasTag('ready')
    }),
    (a, b) => a.isAuthenticated === b.isAuthenticated && a.isLoading === b.isLoading
  )
  return {
    isAuthenticated: computed(() => status.value.isAuthenticated),
    isLoading: computed(() => status.value.isLoading)
  }
}
