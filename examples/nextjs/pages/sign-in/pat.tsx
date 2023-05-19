import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useState } from 'react'

import { Button, Divider, SimpleGrid, TextInput } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useSignInPAT } from '@nhost/nextjs'

import AuthLink from '../../components/AuthLink'
import SignInLayout from '../../layouts/SignInLayout'

export const SignInPasswordPage: NextPage = () => {
  const router = useRouter()
  const { signInPAT } = useSignInPAT()
  const [pat, setPAT] = useState('')

  const signIn = async () => {
    const result = await signInPAT(pat)

    if (result.isError) {
      console.log(result)
      showNotification({
        color: 'red',
        title: 'Error',
        message: result.error.message
      })

      return
    }

    router.replace('/')
  }

  return (
    <SignInLayout title="Sign In with Personal Access Token (PAT)">
      <SimpleGrid cols={1} spacing={6}>
        <TextInput
          type="email"
          placeholder="Personal Access Token"
          value={pat}
          onChange={(e) => setPAT(e.currentTarget.value)}
        />
        <Button fullWidth onClick={signIn}>
          Continue with Personal Access Token
        </Button>
      </SimpleGrid>
      <Divider />
      <AuthLink link="/sign-in" variant="white">
        &#8592; Other Login Options
      </AuthLink>
    </SignInLayout>
  )
}

export default SignInPasswordPage
