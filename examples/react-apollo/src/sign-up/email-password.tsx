import { Button, Input, Message } from 'rsuite'
import { useEmailPasswordSignUp } from '@nhost/react'
import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

export const EmailPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const [confirmPassword, setConfirmPassword] = useState('')
  const { signUp, error, needsVerification, isSuccess } = useEmailPasswordSignUp(email, password)
  const [errorMessage, setErrorMessage] = useState('')
  useEffect(() => {
    if (needsVerification) {
      console.log('needsVerification')
      navigate('/sign-up/verification-email-sent')
    } else if (isSuccess) {
      console.log('success')
      navigate('/')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsVerification, isSuccess])

  // * Set error message from the registration hook errors
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
      <Input
        value={confirmPassword}
        onChange={setConfirmPassword}
        placeholder="Confirm Password"
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
        onClick={() => {
          setErrorMessage('')
          signUp()
        }}
        block
      >
        Sign up
      </Button>
      <Button as={NavLink} to="/sign-up" block appearance="link">
        &#8592; Other Registration Options
      </Button>
    </div>
  )
}
