import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, Modal, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useSignInWebAuthnPasswordless } from '@nhost/react'

import AuthLink from '../components/AuthLink'

export const EmailPassword: React.FC = () => {
  const { signInWebAuthnPasswordless } = useSignInWebAuthnPasswordless()
  const [email, setEmail] = useState('')
  const navigate = useNavigate()
  const [emailVerificationToggle, setEmailVerificationToggle] = useState(false)

  const signIn = async () => {
    const result = await signInWebAuthnPasswordless(email)
    if (result.isError) {
      showNotification({
        color: 'red',
        title: 'Error',
        message: result.error?.message
      })
    } else if (result.needsEmailVerification) {
      setEmailVerificationToggle(true)
    } else if (result.isSuccess) {
      navigate('/', { replace: true })
    }
  }

  return (
    <>
      <Modal
        title="Awaiting email verification"
        transition="fade"
        centered
        transitionDuration={600}
        opened={emailVerificationToggle}
        onClose={() => {
          setEmailVerificationToggle(false)
        }}
      >
        You need to verify your email first. Please check your mailbox and follow the confirmation
        link to complete the registration.
      </Modal>
      <TextInput
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email Address"
        size="lg"
        autoFocus
        style={{ marginBottom: '0.5em' }}
      />
      <Button fullWidth onClick={signIn}>
        Sign in
      </Button>
      <AuthLink link="/sign-in/forgot-password" variant="white">
        Forgot password?
      </AuthLink>
    </>
  )
}
