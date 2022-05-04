import { useState } from 'react'

import { Button, SimpleGrid, TextInput } from '@mantine/core'
import { useSignInEmailPasswordless } from '@nhost/nextjs'

export const SignUpPasswordlessForm: React.FC = () => {
  const { signInEmailPasswordless } = useSignInEmailPasswordless()
  const [email, setEmail] = useState('')
  return (
    <SimpleGrid cols={1} spacing={6}>
      <TextInput
        type="email"
        placeholder="Email Address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button fullWidth onClick={() => signInEmailPasswordless(email)}>
        Continue with email
      </Button>
    </SimpleGrid>
  )
}

export default SignUpPasswordlessForm
