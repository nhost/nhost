import {
  DocumentNode,
  OperationVariables,
  QueryHookOptions,
  TypedDocumentNode,
  useQuery
} from '@apollo/client'
import { useAuthenticated } from '@nhost/react'

export function useAuthQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: QueryHookOptions<TData, TVariables>
) {
  const isAuthenticated = useAuthenticated()
  const newOptions = { ...options, skip: options?.skip || !isAuthenticated }
  return useQuery(query, newOptions)
}

// TODO useAuthLazyQuery
// TODO useAuthMutation
// TODO useAuthSubscription

// TODO useRoleQuery
// TODO useRoleLazyQuery
// TODO useRoleMutation
// TODO useRoleSubscription
