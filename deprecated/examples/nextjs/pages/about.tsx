import Link from 'next/link'

import { Container, Title } from '@mantine/core'

export const AboutPage: React.FC = () => {
  return (
    <Container>
      <Title>About this example</Title>
      <p>
        This application demonstrates how to create a NextJs frontend that works with the Nhost
        stack .
      </p>
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
          <li>NextJs</li>
          <li>Mantine</li>
          <li>and of course, the Nhost NextJs client</li>
        </ul>
      </div>
      <div>
        Now let&apos;s go to the <Link href="/">home page</Link>
      </div>
    </Container>
  )
}

export default AboutPage
