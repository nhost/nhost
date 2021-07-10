import { gql } from 'graphql-tag'

export const GET_USER_BY_ID = gql`
  query GetUserById($id: uuid!) {
    user: users_by_pk(id: $id) {
      id
      displayName: display_name
      avatarUrl: avatar_url
      account {
        email
      }
    }
  }
`
