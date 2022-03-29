import { useRouter } from 'next/router'

import { useAuthenticationStatus } from '@nhost/nextjs'

export function authProtected(Comp) {
  return function AuthProtected(props) {
    const router = useRouter()
    const { isLoading, isAuthenticated } = useAuthenticationStatus()
    console.log('Authentication guard: check auth status', { isLoading, isAuthenticated })
    if (isLoading) {
      return <div>Loading...</div>
    }

    if (!isAuthenticated) {
      router.push('/')
      return null
    }

    return <Comp {...props} />
  }
}
