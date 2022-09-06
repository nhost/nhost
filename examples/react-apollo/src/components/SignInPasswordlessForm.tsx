import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, Modal, SimpleGrid, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useSignInEmailPasswordless, useSignInSecurityKeyEmail } from '@nhost/react'

export const SignUpPasswordlessForm: React.FC = () => {
  const navigate = useNavigate()

  const { signInEmailPasswordless } = useSignInEmailPasswordless({ redirectTo: '/profile' })
  const { signInSecurityKeyEmail } = useSignInSecurityKeyEmail()

  const [emailVerificationToggle, setEmailVerificationToggle] = useState(false)
  const [emailNeedsVerificationToggle, setEmailNeedsVerificationToggle] = useState(false)

  const [email, setEmail] = useState('')

  const signInEmail = async () => {
    const result = await signInEmailPasswordless(email)
    if (result.isError) {
      showNotification({
        color: 'red',
        title: 'Error',
        message: result.error?.message || null
      })
    } else {
      setEmailVerificationToggle(true)
    }
  }
  const signInDevice = async () => {
    const result = await signInSecurityKeyEmail(email)
    if (result.needsEmailVerification) {
      return
    }
    if (result.isError) {
      showNotification({
        color: 'red',
        title: 'Error',
        message: result.error?.message || null
      })
      return
    }
    navigate('/', { replace: true })
  }
  return (
    <SimpleGrid cols={1} spacing={6}>
      <Modal
        title="Verification email sent"
        centered
        opened={emailVerificationToggle}
        onClose={() => {
          setEmailVerificationToggle(false)
        }}
      >
        A verification email has been sent. Please check your inbox and follow the link to complete
        authentication. This page will automatically redirect you to the authenticated home page
        once the email has been verified.
      </Modal>
      <Modal
        title="Awaiting email verification"
        transition="fade"
        centered
        transitionDuration={600}
        opened={emailNeedsVerificationToggle}
        onClose={() => {
          setEmailNeedsVerificationToggle(false)
        }}
      >
        You need to verify your email first. Please check your mailbox and follow the confirmation
        link to complete the registration.
      </Modal>
      <TextInput
        type="email"
        placeholder="Email Address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button fullWidth onClick={signInDevice}>
        Use a security key
      </Button>
      <Button fullWidth onClick={signInEmail}>
        Send a magic link
      </Button>
    </SimpleGrid>
  )
}

export default SignUpPasswordlessForm
