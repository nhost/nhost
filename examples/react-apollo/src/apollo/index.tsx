import React from 'react'

import { gql } from '@apollo/client'
import { useAuthQuery } from '@nhost/react-apollo'
import { Container, Loader, Title } from '@mantine/core'

const GET_BOOKS = gql`
  query BooksQuery {
    books {
      id
      title
    }
  }
`

export const ApolloPage: React.FC = () => {
  const { loading, data } = useAuthQuery(GET_BOOKS, {
    pollInterval: 5000,
    fetchPolicy: 'cache-and-network'
  })
  return (
    <Container>
      <Title>Apollo GraphQL</Title>
      {loading && <Loader />}
      {data?.books && (
        <ul>
          {data.books.map((book) => (
            <li key={book.id}>{book.title}</li>
          ))}
        </ul>
      )}
    </Container>
  )
}
