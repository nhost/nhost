/* eslint-disable react/react-in-jsx-scope */
import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Button, Input, Message } from 'rsuite'

import { useSignUpEmailPassword } from '@nhost/react'

export const EmailPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const options = useMemo(
    () => ({ displayName: `${firstName} ${lastName}`, metadata: { firstName, lastName } }),
    [firstName, lastName]
  )
  const navigate = useNavigate()
  const [confirmPassword, setConfirmPassword] = useState('')
  const { signUpEmailPassword, error, needsEmailVerification, isSuccess } =
    useSignUpEmailPassword(options)
  const [errorMessage, setErrorMessage] = useState('')
  useEffect(() => {
    if (needsEmailVerification) navigate('/sign-up/verification-email-sent')
    else if (isSuccess) navigate('/')

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsEmailVerification, isSuccess])

  // * Set error message from the registration hook errors
  useEffect(() => {
    setErrorMessage(error?.message || '')
  }, [error])
  // * Reset error message every time the email or password input changed
  useEffect(() => {
    setErrorMessage('')
  }, [email, password])
  // * Show an error message when passwords are different
  useEffect(() => {
    if (password !== confirmPassword) setErrorMessage('Both passwords must be the same')
    else setErrorMessage('')
  }, [password, confirmPassword])
  return (
    <div>
      <Input
        value={firstName}
        onChange={setFirstName}
        placeholder="First name"
        size="lg"
        autoFocus
        style={{ marginBottom: '0.5em' }}
      />
      <Input
        value={lastName}
        onChange={setLastName}
        placeholder="Last name"
        size="lg"
        style={{ marginBottom: '0.5em' }}
      />
      <Input
        value={email}
        onChange={setEmail}
        placeholder="Email Address"
        size="lg"
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
        onClick={async () => {
          setErrorMessage('')
          const result = await signUpEmailPassword(email, password)
          console.log(result)
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
