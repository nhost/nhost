import { useAuthenticationStatus } from '../useAuthenticationStatus'

export function SignedIn({ children }: React.PropsWithChildren<unknown>): JSX.Element | null {
  const { isAuthenticated } = useAuthenticationStatus()

  if (!isAuthenticated) {
    return null
  }
  return <>{children}</>
}
