import { GraphQLError } from 'graphql'
import { ErrorPayload } from '../../utils/types'

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

/**@deprecated */
export type DeprecatedNhostGraphqlRequestResponse<T = unknown> =
  | {
      data: null
      error: Error | object | object[]
    }
  | {
      data: T
      error: null
    }

/** Subset of RequestInit parameters that are supported by the graphql client */
export interface NhostGraphqlRequestConfig {
  headers?: Record<string, string>
}
