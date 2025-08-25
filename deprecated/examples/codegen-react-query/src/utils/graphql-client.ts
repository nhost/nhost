import { nhost } from './nhost'
import { GraphQLClient } from 'graphql-request'
// import { TypedQueryDocumentNode } from 'graphql'

type AuthHeaderProps = {
  authorization?: string
}

export const gqlClient = new GraphQLClient(nhost.graphql.getUrl(), {
  headers: () => {
    const authHeaders = {} as AuthHeaderProps

    if (nhost.auth.isAuthenticated()) {
      authHeaders['authorization'] = `Bearer ${nhost.auth.getAccessToken()}`
    }

    return {
      'Content-Type': 'application/json',
      ...authHeaders
    }
  }
})
