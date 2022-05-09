import { useState } from 'react'

import { Button, Modal, SimpleGrid, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useSignInEmailPasswordless } from '@nhost/nextjs'

export const SignUpPasswordlessForm: React.FC = () => {
  const { signInEmailPasswordless } = useSignInEmailPasswordless({ redirectTo: '/guarded-ssr' })
  const [emailVerificationToggle, setEmailVerificationToggle] = useState(false)

  const [email, setEmail] = useState('')
  const signIn = async () => {
    const result = await signInEmailPasswordless(email)
    if (result.isError) {
      showNotification({
        color: 'red',
        title: 'Error',
        message: result.error.message
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
      <TextInput
        type="email"
        placeholder="Email Address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button fullWidth onClick={signIn}>
        Continue with email
      </Button>
    </SimpleGrid>
  )
}

export default SignUpPasswordlessForm
