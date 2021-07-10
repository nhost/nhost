import { usePrivateRoute } from '@hooks/usePrivateRoute'
import Login from '@modules/auth/login/Login'
import Layout from '@modules/layout/Layout'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'

export default function LoginPage(): ReactElement {
  const router = useRouter()
  const { redirectTo, user, removeRedirectTo } = usePrivateRoute()

  useEffect(() => {
    if (user) {
      router.push(redirectTo || '/')
    }
    return () => {
      removeRedirectTo()
    }
  }, [removeRedirectTo, user, redirectTo, router])

  console.warn('user in login')
  // remove this as the login page is never shown
  // if (user === null) {
  //   return <FullPageLoader />
  // }

  return !user ? (
    <Layout>
      <Login />
    </Layout>
  ) : null
}
