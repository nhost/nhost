import { gql } from '@apollo/client'
import { Card, Group, Title } from '@mantine/core'
import { useProviderLink } from '@nhost/react'
import { useAuthQuery } from '@nhost/react-apollo'
import { FaGithub } from 'react-icons/fa'
import AuthLink from 'src/components/AuthLink'
import { AuthUserProviders } from 'src/generated'

export const ConnectSocials: React.FC = () => {
  const { github } = useProviderLink({
    connect: true,
    redirectTo: `${window.location.origin}/profile`
  })

  const AUTH_USER_PROVIDERS = gql`
    query getAuthUserProviders {
      authUserProviders {
        id
        providerId
      }
    }
  `

  const { data } = useAuthQuery<{
    authUserProviders: AuthUserProviders[]
  }>(AUTH_USER_PROVIDERS, {
    pollInterval: 5000,
    fetchPolicy: 'cache-and-network'
  })

  const isGithubConnected = data?.authUserProviders?.some((item) => item.providerId === 'github')

  return (
    <Card shadow="sm" p="lg" m="sm">
      <Title style={{ marginBottom: '1rem' }}>Connect with social providers</Title>
      {!isGithubConnected ? (
        <AuthLink leftIcon={<FaGithub />} link={github} color="#333" disabled={isGithubConnected}>
          Connect with GitHub
        </AuthLink>
      ) : (
        <Group>
          <FaGithub /> <span>Github connected</span>
        </Group>
      )}
    </Card>
  )
}
