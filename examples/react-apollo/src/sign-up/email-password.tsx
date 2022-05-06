/* eslint-disable react/react-in-jsx-scope */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useSignUpEmailPassword } from '@nhost/react'
import { Button, Divider, Modal, PasswordInput, SimpleGrid, TextInput } from '@mantine/core'
import AuthLink from '../components/AuthLink'
import { showNotification } from '@mantine/notifications'

export const EmailPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailVerificationToggle, setEmailVerificationToggle] = useState(false)
  const differentPassword = useMemo(
    () => password && password !== confirmPassword && 'Should match the given password',
    [password, confirmPassword]
  )
  const options = useMemo(
    () => ({ displayName: `${firstName} ${lastName}`, metadata: { firstName, lastName } }),
    [firstName, lastName]
  )
  const navigate = useNavigate()
  const { signUpEmailPassword } = useSignUpEmailPassword(options)

  const signUp = async () => {
    const result = await signUpEmailPassword(email, password, { metadata: { firstName, lastName } })
    if (result.isError) {
      showNotification({
        color: 'red',
        title: 'Error',
        message: result.error?.message
      })
    } else if (result.needsEmailVerification) {
      setEmailVerificationToggle(true)
    } else {
      navigate('/', { replace: true })
    }
  }
  return (
    <>
      <Modal
        title="Verification email sent"
        transition="fade"
        centered
        transitionDuration={600}
        opened={emailVerificationToggle}
        onClose={() => {
          setEmailVerificationToggle(false)
        }}
      >
        A email has been sent to {email}. Please follow the link to verify your email address and to
        complete your registration.
      </Modal>
      <SimpleGrid cols={1} spacing={6}>
        <TextInput
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <TextInput
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <TextInput
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordInput
          placeholder="Confirm Password"
          error={differentPassword}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button fullWidth onClick={signUp}>
          Continue with email + password
        </Button>
      </SimpleGrid>
      <Divider />
      <AuthLink link="/sign-up" variant="white">
        &#8592; Other Registration Options
      </AuthLink>
    </>
  )
}
