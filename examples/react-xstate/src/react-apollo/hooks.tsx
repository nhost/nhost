import { useMemo } from 'react'

import {
  useQuery,
  OperationVariables,
  DocumentNode,
  TypedDocumentNode,
  QueryHookOptions
} from '@apollo/client'

import { useAuthenticated } from '../react'

export function useAuthQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: QueryHookOptions<TData, TVariables>
) {
  const isAuthenticated = useAuthenticated()
  const newOptions = useMemo(
    () => ({ ...options, skip: options?.skip || !isAuthenticated }),
    [isAuthenticated, options]
  )
  return useQuery(query, newOptions)
}
