import { NextPage } from 'next'

import { Divider } from '@mantine/core'

import AuthLink from '../../components/AuthLink'
import SignUpPasswordlessForm from '../../components/SignUpServerlessForm'
import SignUpLayout from '../../layouts/SignUpLayout'

export const SignUpPasswordlessPage: NextPage = () => (
  <SignUpLayout title="Passwordless Sign Up">
    <SignUpPasswordlessForm />
    <Divider />
    <AuthLink link="/sign-up" variant="white">
      &#8592; Other Registration Options
    </AuthLink>
  </SignUpLayout>
)

export default SignUpPasswordlessPage
