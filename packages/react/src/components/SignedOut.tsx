import { useAuthenticationStatus } from '../useAuthenticationStatus'

export function SignedOut({ children }: React.PropsWithChildren<unknown>): JSX.Element | null {
  const { isAuthenticated } = useAuthenticationStatus()

  if (isAuthenticated) {
    return null
  }
  return <>{children}</>
}
