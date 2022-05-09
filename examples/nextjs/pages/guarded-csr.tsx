import { Container, Title } from '@mantine/core'
import { useAccessToken } from '@nhost/nextjs'

import { authProtected } from '../components/protected-route'

const ClientSideAuthPage: React.FC = () => {
  const accessToken = useAccessToken()
  return (
    <Container>
      <Title>Guarded Client-side Page</Title>
      <div>Access token: {accessToken}</div>
    </Container>
  )
}

export default authProtected(ClientSideAuthPage)
