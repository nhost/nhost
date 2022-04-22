import React from 'react'
import { Panel, Table } from 'rsuite'

import { gql } from '@apollo/client'
import { useAuthQuery } from '@nhost/react-apollo'

const GET_BOOKS = gql`
  query BooksQuery {
    books {
      id
      title
    }
  }
`

const { Column, Cell, HeaderCell } = Table
export const ApolloPage: React.FC = () => {
  const { loading, data } = useAuthQuery(GET_BOOKS, {
    pollInterval: 5000,
    fetchPolicy: 'cache-and-network'
  })
  return (
    <Panel header="Apollo GraphQL">
      <Table loading={loading} data={data?.books || []} bordered cellBordered>
        <Column key="id" fixed width={300}>
          <HeaderCell>Id</HeaderCell>
          <Cell dataKey="id" />
        </Column>
        <Column key="title" fixed flexGrow={1}>
          <HeaderCell>Title</HeaderCell>
          <Cell dataKey="title" />
        </Column>
      </Table>
    </Panel>
  )
}
