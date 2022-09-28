import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, Divider, Modal, SimpleGrid, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useSignInEmailSecurityKey } from '@nhost/react'

import AuthLink from '../components/AuthLink'

export const SecurityKeySignIn: React.FC = () => {
  const { signInEmailSecurityKey } = useSignInEmailSecurityKey()
  const [email, setEmail] = useState('')
  const navigate = useNavigate()
  const [emailVerificationToggle, setEmailVerificationToggle] = useState(false)

  const signIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { isError, isSuccess, needsEmailVerification, error } = await signInEmailSecurityKey(
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
        You need to verify your email first. Please check your mailbox and follow the confirmation
        link to complete the registration.
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
          Sign in with a security key
        </Button>
      </form>
      <Divider />
      <AuthLink link="/sign-in" variant="white">
        &#8592; Other Sign-in Options
      </AuthLink>
    </SimpleGrid>
  )
}
