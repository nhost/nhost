/**
 * GQTY: You can safely modify this file and Query Fetcher based on your needs
 */

import type { QueryFetcher } from 'gqty'
import { createClient } from 'gqty'

import { createReactClient } from '@gqty/react'

import { nhost } from '../utils/nhost'

import type { GeneratedSchema, SchemaObjectTypes, SchemaObjectTypesNames } from './schema.generated'
import { generatedSchema, scalarsEnumsHash } from './schema.generated'

const queryFetcher: QueryFetcher = async function (query, variables, fetchOptions) {
  const headers: any = {
    'Content-Type': 'application/json'
  }

  const isAuthenticated = nhost.auth.isAuthenticated()

  if (isAuthenticated) {
    headers['Authorization'] = `Bearer ${nhost.auth.getAccessToken()}`
  }

  const response = await fetch('http://localhost:1337/v1/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      variables
    }),
    mode: 'cors',
    ...fetchOptions
  })

  const json = await response.json()


  return json
}

export const client = createClient<GeneratedSchema, SchemaObjectTypesNames, SchemaObjectTypes>({
  schema: generatedSchema,
  scalarsEnumsHash,
  queryFetcher
})

const { query, mutation, mutate, subscription, resolved, refetch, track } = client

export { mutate, mutation, query, refetch, resolved, subscription, track }

const {
  graphql,
  useQuery,
  usePaginatedQuery,
  useTransactionQuery,
  useLazyQuery,
  useRefetch,
  useMutation,
  useMetaState,
  prepareReactRender,
  useHydrateCache,
  prepareQuery
} = createReactClient<GeneratedSchema>(client, {
  defaults: {
    suspense: true,
    staleWhileRevalidate: false
  }
})

export {
  graphql,
  prepareQuery,
  prepareReactRender,
  useHydrateCache,
  useLazyQuery,
  useMetaState,
  useMutation,
  usePaginatedQuery,
  useQuery,
  useRefetch,
  useTransactionQuery
}

export * from './schema.generated'
