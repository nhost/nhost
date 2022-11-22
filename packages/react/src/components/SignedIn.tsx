import { useAuthenticationStatus } from '../useAuthenticationStatus'

/**
 * Use `<SignedIn />` to control the rendering of components for users. Components inside `<SignedIn />` are only rendered if the user is authenticated.
 *
 * @example
 * ```tsx
 * import { NhostProvider, SignedOut } from "@nhost/react";
 * import { nhost } from '@/utils/nhost';
 *
 * function Page() {
 *   return (
 *    <NhostProvider nhost={nhost}>
 *     <SignedIn>
 *      <h1>Only rendered if the user is authenticated</h1>
 *    </SignedIn>
 *   </NhostProvider>
 *  )
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/signed-in
 *
 * @component
 */

export function SignedIn({ children }: React.PropsWithChildren<unknown>): JSX.Element | null {
  const { isAuthenticated } = useAuthenticationStatus()

  if (!isAuthenticated) {
    return null
  }
  return <>{children}</>
}
