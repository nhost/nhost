import { Heading, Text } from '@chakra-ui/react'
import SocialAuthButton from '@components/buttons/SocialAuthButton'
import AuthContainer from '@modules/auth/AuthContainer'
import RegisterForm from '@modules/auth/register/RegisterForm'
import { ReactElement } from 'react'

const Register = (): ReactElement => {
  return (
    <AuthContainer>
      <Heading as="h2" textAlign="center">
        Register
      </Heading>
      <Text>
        We encourage people to create an account through <strong>LinkedIn</strong>. However, you can
        also use either <strong>Google</strong> or email and password
      </Text>
      <SocialAuthButton
        provider="linkedin"
        imgSrc="/linkedin.png"
        imgAlt="Register with LinkedIn"
      />
      <SocialAuthButton provider="google" imgSrc="/google.png" imgAlt="Register with Google" />
      <RegisterForm />
    </AuthContainer>
  )
}

export default Register
