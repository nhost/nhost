import { auth } from '@libs/nhost'
import { useAuth } from '@nhost/react-auth'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useLocalStorage } from 'react-use'

interface User {
  id: string
  displayName: string
  email: string
}

interface UsePrivateRouteResult {
  user: User | null
  redirectTo: string
  removeRedirectTo: () => void
}

export function usePrivateRoute(redirectRoute?: string): UsePrivateRouteResult {
  const [redirectTo, setRedirectTo, removeRedirectTo] = useLocalStorage<string>('redirectTo')
  const router = useRouter()
  const user = auth.user()
  const { signedIn } = useAuth()

  useEffect(() => {
    if (!user && !signedIn && router.pathname !== '/login') {
      if (redirectRoute) {
        setRedirectTo(redirectRoute)
      }
      router.push('/login')
    }
  }, [router, redirectRoute, redirectTo, user])

  return {
    user: user ? { id: user.id, displayName: user.display_name, email: user.email } : null,
    redirectTo,
    removeRedirectTo,
  }
}
