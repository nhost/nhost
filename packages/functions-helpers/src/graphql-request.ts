import { GraphQLClient as InitialGraphQLClient } from 'graphql-request'

export class GraphQLClient extends InitialGraphQLClient {
  constructor() {
    super(`${process.env.NHOST_BACKEND_URL}/v1/graphql`, {
      headers: {
        'x-hasura-admin-secret': process.env.NHOST_ADMIN_SECRET!
      }
    })
  }
}
