import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Button, Divider, Input, Message } from 'rsuite'

import { useSignInEmailPassword } from '@nhost/react'

const Footer: React.FC = () => (
  <div>
    <Divider />
    <Button as={NavLink} to="/sign-in" block appearance="link">
      &#8592; Other Login Options
    </Button>
  </div>
)

export const EmailPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const { signInEmailPassword, error, needsMfaOtp, sendMfaOtp } = useSignInEmailPassword(
    email,
    password,
    otp
  )

  const [errorMessage, setErrorMessage] = useState('')
  // * Set error message from the authentication hook errors
  useEffect(() => {
    setErrorMessage(error?.message || '')
  }, [error])
  // * Reset error message every time the email or password input changed
  useEffect(() => {
    setErrorMessage('')
  }, [email, password])

  if (needsMfaOtp)
    return (
      <div>
        <Input
          value={otp}
          onChange={setOtp}
          placeholder="One-time password"
          size="lg"
          autoFocus
          style={{ marginBottom: '0.5em' }}
        />
        {errorMessage && (
          <Message showIcon type="error">
            {errorMessage}
          </Message>
        )}
        <Button appearance="primary" onClick={sendMfaOtp} block>
          Send 2-step verification code
        </Button>
        <Footer />
      </div>
    )
  else
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

        <Button
          appearance="primary"
          onClick={async () => {
            const result = await signInEmailPassword(email, password)
            console.log(result)
          }}
          block
        >
          Sign in
        </Button>
        <Button as={NavLink} block to="/sign-in/forgot-password">
          Forgot password?
        </Button>
        <Footer />
      </div>
    )
}
