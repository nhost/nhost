import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Button, Divider, Input, Message, Notification, toaster } from 'rsuite'

import { useResetPassword } from '@nhost/react'

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const { resetPassword, isSent, error } = useResetPassword({ redirectTo: '/profile' })

  const [errorMessage, setErrorMessage] = useState('')
  // * Set error message from the authentication hook errors
  useEffect(() => {
    setErrorMessage(error?.message || '')
  }, [error])
  // * Reset error message every time the email or password input changed
  useEffect(() => {
    setErrorMessage('')
  }, [email])

  useEffect(() => {
    if (isSent) {
      toaster.push(
        <Notification type="info" header="Info" closable>
          An email has been sent with a passwordless authentication link, so you will be able to
          authenticate and change your password.
        </Notification>
      )
    }
  }, [isSent])
  return (
    <div>
      <Input
        value={email}
        onChange={setEmail}
        placeholder="Email Address"
        size="lg"
        autoFocus
        style={{ marginBottom: '0.5em' }}
      />

      {errorMessage && (
        <Message showIcon type="error">
          {errorMessage}
        </Message>
      )}

      <Button appearance="primary" onClick={() => resetPassword(email)} block>
        Reset your password
      </Button>
      <Divider />
      <Button as={NavLink} to="/sign-in/email-password" block appearance="link">
        &#8592; Sign in with email + password
      </Button>
    </div>
  )
}
