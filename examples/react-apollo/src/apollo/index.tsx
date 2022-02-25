import { gql } from '@apollo/client'
import { Panel, Table } from 'rsuite'
import { useAuthQuery } from '@nhost/react-apollo'

const GET_GREETING = gql`
  query MyQuery {
    test {
      id
      bidon
    }
  }
`

const { Column, Cell, HeaderCell } = Table
export const ApolloPage: React.FC = () => {
  const { loading, data } = useAuthQuery(GET_GREETING, {
    pollInterval: 5000,
    fetchPolicy: 'cache-and-network'
  })
  return (
    <Panel header="Apollo GraphQL">
      <Table loading={loading} data={data?.test || []} bordered cellBordered>
        <Column key="id" fixed width={300}>
          <HeaderCell>Id</HeaderCell>
          <Cell dataKey="id" />
        </Column>
        <Column key="bidon" fixed flexGrow={1}>
          <HeaderCell>Bidon</HeaderCell>
          <Cell dataKey="bidon" />
        </Column>
      </Table>
    </Panel>
  )
}
