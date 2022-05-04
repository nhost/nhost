import { useState } from 'react'

import { Button, SimpleGrid, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useSignInEmailPasswordless } from '@nhost/nextjs'

export const SignUpPasswordlessForm: React.FC = () => {
  const { signInEmailPasswordless } = useSignInEmailPasswordless()
  const [email, setEmail] = useState('')
  const signIn = async () => {
    const result = await signInEmailPasswordless(email)
    if (result.isError) {
      showNotification({
        color: 'red',
        title: 'Error',
        message: result.error.message
      })
    }
  }
  return (
    <SimpleGrid cols={1} spacing={6}>
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
