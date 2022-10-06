import { GetServerSideProps } from 'next'

import { gql, useQuery } from '@apollo/client'
import { Container, Title } from '@mantine/core'
import { addApolloState, initializeApollo } from '@nhost/apollo'
import { getNhostSession, NhostSession, useAccessToken, useAuthenticated } from '@nhost/nextjs'

import { BACKEND_URL } from '../helpers'

import { nhost } from './_app'

const QUERY = gql`
  query {
    test {
      id
      name
    }
  }
`

export const getServerSideProps: GetServerSideProps = async (context) => {
  const nhostSession = await getNhostSession(BACKEND_URL, context)
  const apolloClient = initializeApollo({ nhost })
  await apolloClient.query({ query: QUERY })

  return addApolloState(apolloClient, {
    props: {
      nhostSession
    }
  })
}

const PublicSSRPage: React.FC<{ initial: NhostSession }> = () => {
  const isAuthenticated = useAuthenticated()
  const accessToken = useAccessToken()

  const { loading, error, data } = useQuery(QUERY)

  if (error) return <span>{error.message}</span>

  if (loading) return <span>loading...</span>

  return (
    <Container>
      <Title>Public Server-side Page</Title>
      User authenticated: {isAuthenticated ? 'yes' : 'no'}
      <div>Access token: {accessToken}</div>
      <div>Data length: {data.length}</div>
    </Container>
  )
}

export default PublicSSRPage
