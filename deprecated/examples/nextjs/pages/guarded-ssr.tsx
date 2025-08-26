import { GetServerSideProps } from 'next'

import { Container, Title } from '@mantine/core'
import { NhostSession, getNhostSession, useAccessToken } from '@nhost/nextjs'

import { authProtected } from '../components/protected-route'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const nhostSession = await getNhostSession({ subdomain: 'local' }, context)
  return {
    props: {
      nhostSession
    }
  }
}

const RefetchPage: React.FC<{ initial: NhostSession }> = () => {
  const accessToken = useAccessToken()
  return (
    <Container>
      <Title>Guarded Server-side Page</Title>
      <div>Access token: {accessToken}</div>
    </Container>
  )
}

export default authProtected(RefetchPage)
