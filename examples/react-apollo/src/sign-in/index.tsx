import React from 'react'
import { FaLock } from 'react-icons/fa'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { Button, Divider, FlexboxGrid, IconButton, Panel } from 'rsuite'

import { Icon } from '@rsuite/icons'

import { OAuthLinks } from '../components'
import { VerificationEmailSent } from '../verification-email-sent'

import { EmailPassword } from './email-password'
import { EmailPasswordless } from './email-passwordless'
import { ForgotPassword } from './forgot-password'
// import { useSignInAnonymous } from '@nhost/react'

const Index: React.FC = () => (
  <div>
    <OAuthLinks />
    <Divider />
    <IconButton
      block
      icon={<Icon as={FaLock} />}
      appearance="ghost"
      as={NavLink}
      to="/sign-in/email-passwordless"
    >
      Continue with passwordless email
    </IconButton>
    <Button as={NavLink} to="/sign-in/email-password" block appearance="link">
      Continue with email + password
    </Button>
  </div>
)

export const SignInPage: React.FC = () => {
  // const { signIn } = useSignInAnonymous()
  return (
    <div style={{ textAlign: 'center' }}>
      <FlexboxGrid justify="center">
        <FlexboxGrid.Item colspan={12}>
          <Panel header={<h2>Log in to the Application</h2>} bordered>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/email-passwordless" element={<EmailPasswordless />} />
              <Route path="/email-password" element={<EmailPassword />} />
              <Route path="/verification-email-sent" element={<VerificationEmailSent />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Routes>
          </Panel>
        </FlexboxGrid.Item>
      </FlexboxGrid>
      <Divider />
      Don&lsquo;t have an account? <Link to="/sign-up">Sign up</Link>
      {/* or{' '}
      <a href="#" onClick={signIn}>
        enter the app anonymously
      </a> */}
    </div>
  )
}
