import Link from 'next/link'

import { Anchor, Center, Text } from '@mantine/core'

import AuthLayout from './AuthLayout'

export const SignUpLayout: React.FC<{ title?: string; children: React.ReactNode }> = (props) => {
  return (
    <AuthLayout
      {...props}
      footer={
        <Center>
          <Text>
            Already have an account?{' '}
            <Anchor component={Link} href="/sign-in">
              Log in
            </Anchor>
          </Text>
        </Center>
      }
    />
  )
}

export default SignUpLayout
