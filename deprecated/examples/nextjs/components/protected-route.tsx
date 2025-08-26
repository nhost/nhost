import { useAuthenticationStatus } from '@nhost/nextjs'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export function authProtected(Comp) {
  return function AuthProtected(props) {
    const router = useRouter()
    const { isLoading, isAuthenticated } = useAuthenticationStatus()
    console.log('Authentication guard: check auth status', { isLoading, isAuthenticated })

    useEffect(() => {
      if (isLoading || isAuthenticated) {
        return
      }
      router.push('/sign-in')
    }, [isAuthenticated, isLoading, router])

    if (isLoading) {
      return <div>Loading...</div>
    }

    return <Comp {...props} />
  }
}
