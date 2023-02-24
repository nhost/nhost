import { gql } from '@apollo/client'

export const BOOKS_QUERY = gql`
  query BookQuery {
    books {
      id
      title
    }
  }
`
