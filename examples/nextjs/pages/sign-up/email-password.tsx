import { NextPage } from 'next'
import { useMemo, useState } from 'react'

import { Button, Divider, PasswordInput, SimpleGrid, TextInput } from '@mantine/core'
import { useSignUpEmailPassword } from '@nhost/nextjs'

import AuthLink from '../../components/AuthLink'
import SignUpLayout from '../../layouts/SignUpLayout'

export const SignUpPasswordPage: NextPage = () => {
  const { signUpEmailPassword } = useSignUpEmailPassword()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const differentPassword = useMemo(
    () => password && password !== confirmPassword && 'Should match the given password',
    [password, confirmPassword]
  )
  return (
    <SignUpLayout title="Email + password Sign Up">
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
        <Button fullWidth onClick={() => signUpEmailPassword(email, password)}>
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
