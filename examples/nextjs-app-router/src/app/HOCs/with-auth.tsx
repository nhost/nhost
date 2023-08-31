import { useAuthenticationStatus } from '@nhost/nextjs'
import { useRouter } from 'next/navigation'
import { FC } from 'react'

const withAuth = <P extends object>(Component: FC<P>) => {
  const ProtectedComponent = (props: P) => {
    const router = useRouter()
    const { isAuthenticated, isLoading } = useAuthenticationStatus()

    if (isLoading) {
      return <p>Loading...</p>
    }

    if (!isAuthenticated) {
      router.push('/sign-in')
      return null
    }

    return <Component {...props} />
  }

  ProtectedComponent.displayName = `Protected-(${Component.displayName})`

  return ProtectedComponent
}

export default withAuth
