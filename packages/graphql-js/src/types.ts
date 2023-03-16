import { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { DocumentNode, GraphQLError } from 'graphql'

// TODO shared with other packages
export type ErrorPayload = {
  error: string
  status: number
  message: string
}

export type RequestOptions<V extends Variables = Variables, T = any> = NhostGraphqlRequestConfig & {
  document: RequestDocument | TypedDocumentNode<T, V>
} & (V extends Record<any, never>
    ? { variables?: V }
    : keyof RemoveIndex<V> extends never
    ? { variables?: V }
    : { variables: V })
export type Variables = { [key: string]: any }

export type RequestDocument = string | DocumentNode

export type RemoveIndex<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K]
}

export interface NhostGraphqlConstructorParams {
  /**
   * GraphQL endpoint.
   */
  url: string
  /**
   * Admin secret. When set, it is sent as an `x-hasura-admin-secret` header for all requests.
   */
  adminSecret?: string
}

export type NhostGraphqlRequestResponse<T = unknown> =
  | {
      data: null
      error: GraphQLError[] | ErrorPayload
    }
  | {
      data: T
      error: null
    }

/** Subset of RequestInit parameters that are supported by the graphql client */
export interface NhostGraphqlRequestConfig {
  headers?: Record<string, string>
}
