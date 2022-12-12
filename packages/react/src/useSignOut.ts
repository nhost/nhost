import { signOutPromise } from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the hook `useSignOut` to sign out the user.
 *
 * @example
 * ```tsx
 * import { useSignOut, useAuthenticated } from '@nhost/react'
 *
 * const Component = () => {
 *   const { signOut } = useSignOut()
 *   const isAuthenticated = useAuthenticated()
 *
 *   if (isAuthenticated) {
 *     return (
 *       <button onClick={() => signOut()}>Sign Out</button>
 *     )
 *   }
 *
 *   return <div>Not authenticated</div>
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-out
 */
export const useSignOut = (stateAll: boolean = false) => {
  const service = useAuthInterpreter()
  const signOut = (valueAll?: boolean | unknown) =>
    signOutPromise(service, typeof valueAll === 'boolean' ? valueAll : stateAll)

  const isSuccess = useSelector(
    service,
    (state) => state.matches({ authentication: { signedOut: 'success' } }),
    (a, b) => a === b
  )

  const error = useSelector(
    service,
    (state) => state.context.errors.signout || null,
    (a, b) => a?.error === b?.error
  )

  return { signOut, isSuccess, error }
}
