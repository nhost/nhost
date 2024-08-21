import { gql } from '@apollo/client'

export const SECURITY_KEYS_LIST = gql`
  query securityKeys($userId: uuid!) {
    authUserSecurityKeys(where: { userId: { _eq: $userId } }) {
      id
      nickname
    }
  }
`
