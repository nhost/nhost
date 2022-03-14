import { Button, Divider, Input, Message } from 'rsuite'
import { useEmailPasswordSignIn } from '@nhost/react'
import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

export const EmailPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { emailPasswordSignIn, error } = useEmailPasswordSignIn(email, password)

  const [errorMessage, setErrorMessage] = useState('')
  // * Set error message from the authentication hook errors
  useEffect(() => {
    setErrorMessage(error?.message || '')
  }, [error])
  // * Reset error message every time the email or password input changed
  useEffect(() => {
    setErrorMessage('')
  }, [email, password])

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
      <Input
        value={password}
        onChange={setPassword}
        placeholder="Password"
        type="password"
        size="lg"
        style={{ marginBottom: '0.5em' }}
      />

      {errorMessage && (
        <Message showIcon type="error">
          {errorMessage}
        </Message>
      )}

      <Button appearance="primary" onClick={emailPasswordSignIn} block>
        Sign in
      </Button>
      <Button as={NavLink} block to="/sign-in/forgot-password">
        Forgot password?
      </Button>
      <Divider />
      <Button as={NavLink} to="/sign-in" block appearance="link">
        &#8592; Other Login Options
      </Button>
    </div>
  )
}
