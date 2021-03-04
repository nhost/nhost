import { GraphQLClient } from 'graphql-request'
import { RequestDocument } from 'graphql-request/dist/types'
import { useQuery, UseQueryResult } from 'react-query'

interface UseGQLQueryProps {
  key: string | unknown[]
  query: RequestDocument
  variables?: unknown
  config?: unknown
}

export const useGQLQuery = <T>({
  key,
  query,
  variables,
  config = {},
}: UseGQLQueryProps): UseQueryResult<T> => {
  const headers = {
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': process.env.NEXT_PUBLIC_HASURA_SECRET,
    },
  }
  const graphqlClient = new GraphQLClient(process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT, headers)
  const fetchData = async () => await graphqlClient.request(query, variables)

  return useQuery(key, fetchData, config)
}
