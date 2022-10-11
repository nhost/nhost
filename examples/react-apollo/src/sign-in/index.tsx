import { FaFingerprint, FaLock } from 'react-icons/fa'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'

import { Anchor, Center, Divider, Text } from '@mantine/core'
import { useSignInAnonymous } from '@nhost/react'

import AuthLayout from '../components/AuthLayout'
import AuthLink from '../components/AuthLink'
import OAuthLinks from '../components/OauthLinks'

import { EmailPassword } from './email-password'
import { EmailPasswordless } from './email-passwordless'
import { ForgotPassword } from './forgot-password'
import { SecurityKeySignIn } from './security-key'

const Index: React.FC = () => (
  <>
    <OAuthLinks />
    <Divider my="sm" />
    <AuthLink leftIcon={<FaFingerprint />} variant="outline" link="/sign-in/security-key">
      Continue with a security key
    </AuthLink>
    <AuthLink leftIcon={<FaLock />} variant="outline" link="/sign-in/email-passwordless">
      Continue with a magic link
    </AuthLink>
    <AuthLink variant="subtle" link="/sign-in/email-password">
      Continue with email + password
    </AuthLink>
  </>
)
export const SignInPage: React.FC = () => {
  const { signInAnonymous } = useSignInAnonymous()
  const navigate = useNavigate()
  const anonymousHandler = async () => {
    const { isSuccess } = await signInAnonymous()
    if (isSuccess) {
      navigate('/')
    }
  }

  return (
    <AuthLayout
      title="Sign in to the Application"
      footer={
        <Center>
          <Text>
            Don&lsquo;t have an account?{' '}
            <Anchor role="link" component={Link} to="/sign-up">
              Sign up
            </Anchor>{' '}
            or{' '}
            <Anchor role="link" onClick={anonymousHandler}>
              sign in anonymously
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
        <Route path="/security-key" element={<SecurityKeySignIn />} />
      </Routes>
    </AuthLayout>
  )
}
