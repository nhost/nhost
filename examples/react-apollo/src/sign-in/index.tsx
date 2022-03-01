/* eslint-disable jsx-a11y/anchor-is-valid */
import { NavLink, Route, Routes } from 'react-router-dom'
import { Button, Divider, FlexboxGrid, IconButton, Panel } from 'rsuite'
import { Icon } from '@rsuite/icons'
import { FaLock } from 'react-icons/fa'

import { EmailPasswordlessForm, OAuthLinks } from '../components'
import { VerificationEmailSent } from '../verification-email-sent'
import { Password } from './email-password'
import { ForgotPassword } from './forgot-password'
// import { useAnonymousSignIn } from '@nhost/react'

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
    <Button as={NavLink} to="/sign-in/password" block appearance="link">
      Continue with email + password
    </Button>
  </div>
)

export const SignInPage: React.FC = () => {
  // const { signIn } = useAnonymousSignIn()
  return (
    <div style={{ textAlign: 'center' }}>
      <FlexboxGrid justify="center">
        <FlexboxGrid.Item colspan={12}>
          <Panel header={<h2>Log in to the Application</h2>} bordered>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/email-passwordless" element={<EmailPasswordlessForm />} />
              <Route path="/password" element={<Password />} />
              <Route path="/verification-email-sent" element={<VerificationEmailSent />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Routes>
          </Panel>
        </FlexboxGrid.Item>
      </FlexboxGrid>
      <Divider />
      {/* Don't have an account? <Link to="/sign-up">Sign up</Link> or{' '}
      <a href="#" onClick={signIn}>
        enter the app anonymously
      </a> */}
    </div>
  )
}
