import { APPLICATION } from '@config/index'

import { ASTNode } from 'graphql'
import { GraphQLClient } from 'graphql-request'
import { Variables } from 'graphql-request/dist/types'
import { print } from 'graphql/language/printer'

const client = new GraphQLClient(APPLICATION.HASURA_ENDPOINT, {
  get headers() {
    return APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
      ? { 'x-hasura-admin-secret': APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET }
      : undefined
  }
})

/**
 * To take advantage of syntax highlighting and auto-formatting
 * for GraphQL template literal tags (`gql`) in `src/utils/queries.ts`,
 * you need to `print()` queries before passing them to `graphql-request`.

 * https://github.com/prisma-labs/graphql-request/issues/10
 */
export async function request<T extends unknown>(
  query: ASTNode,
  variables?: Variables
): Promise<T> {
  try {
    return (await client.request(print(query), variables)) as T
  } catch (err) {
    throw new Error('Could not perform request')
  }
}
