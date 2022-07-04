import axios, { AxiosInstance, AxiosRequestConfig, AxiosRequestHeaders } from 'axios'
import { DocumentNode, print } from 'graphql'

import { TypedDocumentNode } from '@graphql-typed-document-node/core'

import { GraphqlRequestResponse, GraphqlResponse } from '../utils/types'

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

/**
 * @alias GraphQL
 */
export class NhostGraphqlClient {
  private url: string
  private instance: AxiosInstance
  private accessToken: string | null
  private adminSecret?: string

  constructor(params: NhostGraphqlConstructorParams) {
    const { url, adminSecret } = params

    this.url = url
    this.accessToken = null
    this.adminSecret = adminSecret
    this.instance = axios.create({
      baseURL: url
    })
  }

  /**
   * Use `nhost.graphql.request` to send a GraphQL request. For more serious GraphQL usage in your app we recommend using a GraphQL client such as Apollo Client (https://www.apollographql.com/docs/react).
   *
   * @example
   * ```ts
   * const CUSTOMERS = gql`
   *  query {
   *   customers {
   *    id
   *    name
   *  }
   * }
   * `
   * const { data, error } = await nhost.graphql.request(CUSTOMERS)
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/nhost-js/graphql/request
   */
  async request<T = any, V = any>(
    document: string | DocumentNode | TypedDocumentNode<T, V>,
    variables?: V,
    config?: AxiosRequestConfig
  ): Promise<GraphqlRequestResponse<T>> {
    // add auth headers if any
    const headers = {
      ...this.generateAccessTokenHeaders(),
      ...config?.headers
    }

    try {
      const operationName = ''
      const res = await this.instance.post<GraphqlResponse<T>>(
        '',
        {
          operationName: operationName || undefined,
          query: typeof document === 'string' ? document : print(document),
          variables
        },
        { ...config, headers }
      )

      const responseData = res.data
      const { data } = responseData

      if (responseData.errors) {
        return {
          data: null,
          error: responseData.errors
        }
      }

      if (typeof data !== 'object' || Array.isArray(data) || data === null) {
        return {
          data: null,
          error: new Error('incorrect response data from GraphQL server')
        }
      }

      return { data, error: null }
    } catch (error) {
      if (error instanceof Error) {
        return { data: null, error }
      }
      console.error(error)
      return {
        data: null,
        error: new Error('Unable to get do GraphQL request')
      }
    }
  }

  /**
   * Use `nhost.graphql.getUrl` to get the GraphQL URL.
   *
   * @example
   * ```ts
   * const url = nhost.graphql.getUrl();
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/nhost-js/graphql/get-url
   */
  getUrl(): string {
    return this.url
  }

  /**
   * Use `nhost.graphql.setAccessToken` to a set an access token to be used in subsequent graphql requests. Note that if you're signin in users with `nhost.auth.signIn()` the access token will be set automatically.
   *
   * @example
   * ```ts
   * nhost.graphql.setAccessToken('some-access-token')
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/nhost-js/graphql/set-access-token
   */
  setAccessToken(accessToken: string | undefined) {
    if (!accessToken) {
      this.accessToken = null
      return
    }

    this.accessToken = accessToken
  }

  private generateAccessTokenHeaders(): AxiosRequestHeaders {
    if (this.adminSecret) {
      return {
        'x-hasura-admin-secret': this.adminSecret
      }
    }
    if (this.accessToken) {
      return {
        Authorization: `Bearer ${this.accessToken}`
      }
    }
    return {}
  }
}
