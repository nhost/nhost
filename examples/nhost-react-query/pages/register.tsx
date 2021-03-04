import Layout from '@modules/layout/Layout'
import Register from '@modules/auth/register/Register'
import { ReactElement } from 'react'

export default function RegisterPage(): ReactElement {
  return (
    <Layout>
      <Register />
    </Layout>
  )
}
