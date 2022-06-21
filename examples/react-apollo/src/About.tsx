import { Link } from 'react-router-dom'

import { Container, Title } from '@mantine/core'

export const AboutPage: React.FC = () => {
  return (
    <Container>
      <Title>About this example</Title>
      <p>This application demonstrates the available features of the Nhost stack.</p>
      <div>
        Nhost cloud leverages the following services in the backend:
        <ul>
          <li>Hasura</li>
          <li>Hasura Auth</li>
          <li>Hasura Storage</li>
          <li>Custom functions</li>
        </ul>
      </div>
      <div>
        This frontend is built with the following technologies:
        <ul>
          <li>React</li>
          <li>React-router</li>
          <li>Mantine</li>
          <li>and of course, the Nhost React client</li>
        </ul>
      </div>
      <div>
        Now let&apos;s go to the <Link to="/">index page</Link>
      </div>
    </Container>
  )
}
