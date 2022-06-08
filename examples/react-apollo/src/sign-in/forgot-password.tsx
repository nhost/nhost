import React, { useState } from 'react'

import { Button, Divider, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useResetPassword } from '@nhost/react'

import AuthLink from '../components/AuthLink'

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('')
  const { resetPassword } = useResetPassword({
    redirectTo: '/profile'
  })

  const reset = async () => {
    const result = await resetPassword(email)
    if (result.isError) {
      showNotification({
        color: 'red',
        title: 'Error',
        message: result.error?.message
      })
    } else {
      showNotification({
        title: 'Email sent',
        message: 'A link to reset your password has been sent by email'
      })
    }
  }
  return (
    <>
      <TextInput
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email Address"
        size="lg"
        autoFocus
        style={{ marginBottom: '0.5em' }}
      />

      <Button onClick={reset} fullWidth>
        Reset your password
      </Button>
      <Divider />

      <AuthLink link="/sign-in/email-password" variant="white">
        &#8592; Sign in with email + password
      </AuthLink>
    </>
  )
}
