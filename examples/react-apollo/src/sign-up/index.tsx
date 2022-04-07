import React from 'react'
import { FaLock } from 'react-icons/fa'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { Button, Divider, FlexboxGrid, IconButton, Panel } from 'rsuite'

import { Icon } from '@rsuite/icons'

import { OAuthLinks } from '../components'
import { VerificationEmailSent } from '../verification-email-sent'

import { EmailPassword } from './email-password'
import { EmailPasswordless } from './email-passwordless'

const Index: React.FC = () => (
  <div>
    <OAuthLinks />
    <Divider />
    <IconButton
      block
      icon={<Icon as={FaLock} />}
      appearance="ghost"
      as={NavLink}
      to="/sign-up/email-passwordless"
    >
      Continue with passwordless email
    </IconButton>
    <Button as={NavLink} to="/sign-up/email-password" block appearance="link">
      Continue with email + password
    </Button>
  </div>
)

export const SignUpPage: React.FC = () => {
  return (
    <div style={{ textAlign: 'center' }}>
      <FlexboxGrid justify="center">
        <FlexboxGrid.Item colspan={12}>
          <Panel header={<h2>Sign up</h2>} bordered>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/email-password" element={<EmailPassword />} />
              <Route path="/email-passwordless" element={<EmailPasswordless />} />
              <Route path="/verification-email-sent" element={<VerificationEmailSent />} />
            </Routes>
          </Panel>
        </FlexboxGrid.Item>
      </FlexboxGrid>
      <Divider />
      Already have an account? <Link to="/sign-in">Log in</Link>
    </div>
  )
}
