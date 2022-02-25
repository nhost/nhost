import { gql } from '@apollo/client'
import { Panel } from 'rsuite'
import { useAuthQuery } from '@nhost/react-apollo'

const GET_GREETING = gql`
  query MyQuery {
    test {
      id
    }
  }
`

export const ApolloPage: React.FC = () => {
  const { loading, data, error } = useAuthQuery(GET_GREETING)
  return <Panel header="Apollo GraphQL">TODO</Panel>
}
