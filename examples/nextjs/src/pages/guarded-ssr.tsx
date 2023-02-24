import { GetServerSideProps } from 'next'

import { Container, Title } from '@mantine/core'
import { getNhostSession, NhostSession, useAccessToken } from '@nhost/nextjs'

import { authProtected } from '../components/protected-route'
import { BACKEND_URL } from '../helpers'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const nhostSession = await getNhostSession(BACKEND_URL, context)
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
