import { gql } from '@apollo/client'
export const AUTHOR_LIST = gql`
  query {
    author(order_by: [{ name: asc }]) {
      name
    }
  }
`
