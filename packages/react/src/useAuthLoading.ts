import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * @deprecated
 * When using both {@link useAuthLoading} and {@link useAuthenticated} together, their initial state will change
 * three times:
 *
 * `(true, false)` -> `(false, false)` -> `(false, true)`
 *
 * Use {@link useAuthenticationStatus} instead.
 */
export const useAuthLoading = (): boolean => {
  const service = useAuthInterpreter()
  return useSelector(service, (state) => state.hasTag('loading'))
}
