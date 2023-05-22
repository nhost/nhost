import { Fragment, PropsWithChildren, createElement } from 'react'
import { useAuthenticationStatus } from '../useAuthenticationStatus'

/**
 * Use `<SignedIn />` to control the rendering of components for users. Components inside `<SignedIn />` are only rendered if the user is authenticated.
 *
 * @example
 * ```tsx
 * import { NhostProvider, SignedIn } from "@nhost/react";
 * import { nhost } from '@/utils/nhost';
 *
 * function Page() {
 *   return (
 *     <NhostProvider nhost={nhost}>
 *       <SignedIn>
 *         <h1>Only rendered if the user is authenticated</h1>
 *       </SignedIn>
 *     </NhostProvider>
 *   )
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/signed-in
 * @category Components
 */

export function SignedIn({ children }: PropsWithChildren<unknown>) {
  const { isAuthenticated } = useAuthenticationStatus()

  if (!isAuthenticated) {
    return null
  }

  return createElement(Fragment, null, children)
}
