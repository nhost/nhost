import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'

import { Button, Divider, Modal, PasswordInput, SimpleGrid, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useSignUpEmailPassword } from '@nhost/nextjs'

import AuthLink from '../../components/AuthLink'
import SignUpLayout from '../../layouts/SignUpLayout'

export const SignUpPasswordPage: NextPage = () => {
  const router = useRouter()
  const { signUpEmailPassword } = useSignUpEmailPassword()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailVerificationToggle, setEmailVerificationToggle] = useState(false)
  const differentPassword = useMemo(
    () => password && password !== confirmPassword && 'Should match the given password',
    [password, confirmPassword]
  )
  const signUp = async () => {
    const result = await signUpEmailPassword(email, password)
    if (result.isError) {
      showNotification({
        color: 'red',
        title: 'Error',
        message: result.error.message
      })
    } else if (result.needsEmailVerification) {
      setEmailVerificationToggle(true)
    } else {
      router.replace('/')
    }
  }
  return (
    <SignUpLayout title="Email + password Sign Up">
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
    </SignUpLayout>
  )
}

export default SignUpPasswordPage
