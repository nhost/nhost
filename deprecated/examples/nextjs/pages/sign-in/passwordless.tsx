import { NextPage } from 'next'

import { Divider } from '@mantine/core'

import AuthLink from '../../components/AuthLink'
import SignUpPasswordlessForm from '../../components/SignUpServerlessForm'
import SignInLayout from '../../layouts/SignInLayout'

export const SignInPasswordlessPage: NextPage = () => (
  <SignInLayout title="Passwordless Sign In">
    <SignUpPasswordlessForm />
    <Divider />
    <AuthLink link="/sign-in" variant="white">
      &#8592; Other Login Options
    </AuthLink>
  </SignInLayout>
)

export default SignInPasswordlessPage
