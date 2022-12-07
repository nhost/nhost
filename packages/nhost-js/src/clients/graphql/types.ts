import { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { DocumentNode } from 'graphql'

export type RequestOptions<V extends Variables = Variables, T = any> = {
  document: RequestDocument | TypedDocumentNode<T, V>
  headers?: HeadersInit
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

export type GraphqlRequestResponse<T = unknown> =
  | {
      data: null
      error: Error | object | object[]
    }
  | {
      data: T
      error: null
    }
