import { Button, Divider, Input, Message } from 'rsuite'
import { useResetPassord } from '@nhost/react'
import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const { resetPassword, isSent, error } = useResetPassord(email)

  const [errorMessage, setErrorMessage] = useState('')
  // * Set error message from the authentication hook errors
  useEffect(() => {
    setErrorMessage(error?.message || '')
  }, [error])
  // * Reset error message every time the email or password input changed
  useEffect(() => {
    setErrorMessage('')
  }, [email])

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

      {isSent && (
        <Message showIcon type="success">
          An email has been sent with a passwordless authentication link, so you'll be able to
          authenticate and reset your password.
        </Message>
      )}

      <Button appearance="primary" onClick={resetPassword} block>
        Reset your password
      </Button>
      <Divider />
      <Button as={NavLink} to="/sign-in" block appearance="link">
        &#8592; Login
      </Button>
    </div>
  )
}
