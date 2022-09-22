import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, Modal, SimpleGrid, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useSignUpSecurityKeyEmail } from '@nhost/react'

export const SecurityKeySignUp: React.FC = () => {
  const { signUpSecurityKeyEmail } = useSignUpSecurityKeyEmail()
  const [email, setEmail] = useState('')
  const navigate = useNavigate()
  const [emailVerificationToggle, setEmailVerificationToggle] = useState(false)

  const signIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { isError, isSuccess, needsEmailVerification, error } = await signUpSecurityKeyEmail(
      email
    )
    if (isError) {
      showNotification({
        color: 'red',
        title: 'Error',
        message: error?.message
      })
    } else if (needsEmailVerification) {
      setEmailVerificationToggle(true)
    } else if (isSuccess) {
      navigate('/', { replace: true })
    }
  }

  return (
    <SimpleGrid cols={1} spacing={6}>
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
        A email has been sent to {email}. Please follow the link to verify your email address and to
        complete your registration.
      </Modal>
      <form onSubmit={signIn}>
        <TextInput
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          autoFocus
          style={{ marginBottom: '0.5em' }}
        />
        <Button fullWidth type="submit">
          Sign up with a security key
        </Button>
      </form>
    </SimpleGrid>
  )
}
