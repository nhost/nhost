import { GetServerSideProps } from 'next'

import { Container, Title } from '@mantine/core'
import { NhostSession, getNhostSession, useAccessToken, useAuthenticated } from '@nhost/nextjs'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const nhostSession = await getNhostSession({ subdomain: 'local' }, context)
  return {
    props: {
      nhostSession
    }
  }
}

const PublicSSRPage: React.FC<{ initial: NhostSession }> = () => {
  const isAuthenticated = useAuthenticated()
  const accessToken = useAccessToken()

  return (
    <Container>
      <Title>Public Server-side Page</Title>
      User authenticated: {isAuthenticated ? 'yes' : 'no'}
      <div>Access token: {accessToken}</div>
    </Container>
  )
}

export default PublicSSRPage
