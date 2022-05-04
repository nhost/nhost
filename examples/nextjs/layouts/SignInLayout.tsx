import Link from 'next/link'

import { Anchor, Center, Text } from '@mantine/core'
import { useSignInAnonymous } from '@nhost/nextjs'

import AuthLayout from './AuthLayout'

export const SignInLayout: React.FC<{ title?: string; children: React.ReactNode }> = (props) => {
  const { signInAnonymous } = useSignInAnonymous()
  return (
    <AuthLayout
      {...props}
      footer={
        <Center>
          <Text>
            Don&lsquo;t have an account?{' '}
            <Anchor component={Link} href="/sign-up">
              Sign up
            </Anchor>{' '}
            or <Anchor onClick={signInAnonymous}>enter the app anonymously</Anchor>
          </Text>
        </Center>
      }
    />
  )
}

export default SignInLayout
