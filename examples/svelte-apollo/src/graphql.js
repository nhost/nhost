import { gql } from '@apollo/client'
export const AUTHORS = gql`
  query {
    authors(order_by: [{ name: asc }]) {
      name
    }
  }
`
