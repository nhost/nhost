import { useAuthenticationStatus } from '../useAuthenticationStatus'

/**
 * Use `<SignedOut />` to control the rendering of components for users. Components inside `<SignedOut />` are only rendered if the user is not authenticated.
 *
 * @example
 * ```tsx
 * import { NhostProvider, SignedOut } from "@nhost/react";
 * import { nhost } from '@/utils/nhost';
 *
 * function Page() {
 *   return (
 *    <NhostProvider nhost={nhost}>
 *     <SignedOut>
 *      <h1>Only rendered if the user is not authenticated</h1>
 *    </SignedOut>
 *   </NhostProvider>
 *  )
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/signed-out
 *
 * @component
 */

export function SignedOut({ children }: React.PropsWithChildren<unknown>): JSX.Element | null {
  const { isAuthenticated } = useAuthenticationStatus()

  if (isAuthenticated) {
    return null
  }
  return <>{children}</>
}
