import {
  DocumentNode,
  OperationVariables,
  QueryHookOptions,
  SubscriptionHookOptions,
  TypedDocumentNode
} from '@apollo/client'
import { useQuery, useSubscription } from '@apollo/client/react/index.js'
import { useAuthenticated } from '@nhost/react'

export function useAuthQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: QueryHookOptions<TData, TVariables>
) {
  const isAuthenticated = useAuthenticated()
  const newOptions = { ...options, skip: options?.skip || !isAuthenticated }
  return useQuery(query, newOptions)
}

export function useAuthSubscription<TData = any, TVariables = OperationVariables>(
  subscription: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: SubscriptionHookOptions<TData, TVariables>
) {
  const isAuthenticated = useAuthenticated()
  const newOptions: SubscriptionHookOptions<TData, TVariables> = {
    ...options,
    skip: options?.skip || !isAuthenticated
  }

  return useSubscription(subscription, newOptions)
}

// TODO consider other hooks
/*
- useAuthLazyQuery
- useAuthMutation
- useRoleQuery
- useRoleLazyQuery
- useRoleMutation
- useRoleSubscription
*/
