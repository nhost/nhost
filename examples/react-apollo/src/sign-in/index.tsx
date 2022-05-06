import React from 'react'
import { FaLock } from 'react-icons/fa'
import { Link, Route, Routes } from 'react-router-dom'

import OAuthLinks from '../components/OauthLinks'

import { EmailPassword } from './email-password'
import { EmailPasswordless } from './email-passwordless'
import AuthLayout from '../components/AuthLayout'
import { Center, Text, Anchor, Divider } from '@mantine/core'
import AuthLink from '../components/AuthLink'
import { ForgotPassword } from './forgot-password'

const Index: React.FC = () => (
  <>
    <OAuthLinks />
    <Divider my="sm" />
    <AuthLink icon={<FaLock />} variant="outline" link="/sign-in/email-passwordless">
      Continue with passwordless email
    </AuthLink>
    <AuthLink variant="subtle" link="/sign-in/email-password">
      Continue with email + password
    </AuthLink>
  </>
)
export const SignInPage: React.FC = () => {
  return (
    <AuthLayout
      title="Log in to the Application"
      footer={
        <Center>
          <Text>
            Don&lsquo;t have an account?{' '}
            <Anchor component={Link} to="/sign-up">
              Sign up
            </Anchor>
          </Text>
        </Center>
      }
    >
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/email-password" element={<EmailPassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/email-passwordless" element={<EmailPasswordless />} />
      </Routes>
    </AuthLayout>
  )
}
