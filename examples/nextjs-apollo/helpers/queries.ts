import { gql } from '@apollo/client'

export const QUERY = gql`
  query MyQuery {
    test {
      id
    }
  }
`

export const QUERY_INDEX = gql`
  query MyQuery {
    test {
      id
      bidon
    }
  }
`
