import { Heading, Text } from '@chakra-ui/react'
import SocialAuthButton from '@components/buttons/SocialAuthButton'
import AuthContainer from '@modules/auth/AuthContainer'
import LoginForm from '@modules/auth/login/LoginForm'
import { ReactElement } from 'react'

const Login = (): ReactElement => {
  return (
    <AuthContainer>
      <Heading as="h2" textAlign="center">
        Login
      </Heading>
      <Text>Login using one of the following methods.</Text>

      <SocialAuthButton provider="linkedin" imgSrc="/linkedin.png" imgAlt="Sign in with LinkedIn" />
      <SocialAuthButton provider="google" imgSrc="/google.png" imgAlt="Sign in with Google" />
      <LoginForm />
    </AuthContainer>
  )
}

export default Login
