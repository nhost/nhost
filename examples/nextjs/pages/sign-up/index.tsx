import { NextPage } from 'next'
import { FaLock } from 'react-icons/fa'

import { Divider } from '@mantine/core'

import AuthLink from '../../components/AuthLink'
import OAuthLinks from '../../components/OauthLinks'
import SignUpLayout from '../../layouts/SignUpLayout'

export const SignUpPage: NextPage = () => {
  return (
    <SignUpLayout title="Sign Up">
      <OAuthLinks />
      <Divider my="sm" />
      <AuthLink icon={<FaLock />} variant="outline" link="/sign-up/passwordless">
        Continue with passwordless email
      </AuthLink>
      <AuthLink variant="subtle" link="/sign-up/email-password">
        Continue with email + password
      </AuthLink>
    </SignUpLayout>
  )
}

export default SignUpPage
