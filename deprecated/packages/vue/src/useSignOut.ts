import { signOutPromise } from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { unref } from 'vue'
import { RefOrValue } from './helpers'
import { useAuthInterpreter } from './useAuthInterpreter'
import { useError } from './useError'

/**
 * Use the composable `useSignOut` to sign out the user.
 *
 * @example
 * ```jsx
 * import { useSignOut } from '@nhost/vue'
 *
 * const { signOut, isSuccess } = useSignOut()
 *
 * const handleSignOut = async (e) => {
 *   e.preventDefault()
 *   await signOut()
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-out
 */
export const useSignOut = () => {
  const service = useAuthInterpreter()
  const signOut = (
    /** Sign out on all devices */
    all?: RefOrValue<boolean | undefined>
  ) => signOutPromise(service.value, typeof unref(all) === 'boolean' ? unref(all) : false)

  const isSuccess = useSelector(service.value, (state) =>
    state.matches({ authentication: { signedOut: 'success' } })
  )

  const error = useError('signout')

  return { signOut, isSuccess, error }
}
