import { Link } from 'react-router-dom'

import { Anchor, Container, Title } from '@mantine/core'
import { useUserIsAnonymous } from '@nhost/react'

const HomePage: React.FC = () => {
  const isAnonymous = useUserIsAnonymous()
  return (
    <Container>
      <Title>Home page</Title>
      You are authenticated. You have now access to the authorised part of the application.
      {isAnonymous && (
        <p>
          You signed in anonymously.{' '}
          <Anchor role="link" component={Link} to="/sign-up">
            Sign up
          </Anchor>{' '}
          to complete your registration
        </p>
      )}
    </Container>
  )
}
export default HomePage
