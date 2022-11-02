import { FormEvent, useState } from 'react'

import { Button, Modal, SimpleGrid, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useSignInEmailPasswordless } from '@nhost/react'

export const SignUpPasswordlessForm: React.FC = () => {
  const { signInEmailPasswordless } = useSignInEmailPasswordless({ redirectTo: '/profile' })

  const [emailVerificationToggle, setEmailVerificationToggle] = useState(false)
  const [emailNeedsVerificationToggle, setEmailNeedsVerificationToggle] = useState(false)

  const [email, setEmail] = useState('')

  const signInEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
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
      <form onSubmit={signInEmail}>
        <TextInput
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          style={{ marginBottom: '0.5em' }}
        />
        <Button fullWidth type="submit">
          Send a magic link
        </Button>
      </form>
    </SimpleGrid>
  )
}

export default SignUpPasswordlessForm
