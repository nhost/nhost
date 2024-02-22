import { TypedDocumentNode } from '@graphql-typed-document-node/core'
import fetch from 'isomorphic-unfetch'
import { parseRequestArgs } from './parse-args'
import { resolveRequestDocument } from './resolve-request-document'
import {
  NhostGraphqlConstructorParams,
  NhostGraphqlRequestConfig,
  NhostGraphqlRequestResponse,
  RemoveIndex,
  RequestDocument,
  RequestOptions,
  Variables
} from './types'

import jwtDecode, { JwtPayload } from 'jwt-decode'

/**
 * @alias GraphQL
 */
export class NhostGraphqlClient {
  readonly _url: string
  private accessToken: string | null
  private adminSecret?: string

  constructor(params: NhostGraphqlConstructorParams) {
    const { url, adminSecret } = params

    this._url = url
    this.accessToken = null
    this.adminSecret = adminSecret
  }

  private isAccessTokenValid = () => {
    if (!this.accessToken) {
      return false
    }

    try {
      const decodedToken: JwtPayload = jwtDecode(this.accessToken)
      return decodedToken.exp != null && decodedToken.exp * 1000 > Date.now()
    } catch (error) {
      console.error('Error decoding token:', error)
      return false
    }
  }

  private awaitForValidAccessToken = async () => {
    if (this.isAccessTokenValid()) {
      return true
    }

    const waitForValidToken = () => {
      if (this.isAccessTokenValid()) {
        return Promise.resolve(true)
      }
      return new Promise((resolve) => {
        setTimeout(() => waitForValidToken().then(resolve), 100)
      })
    }

    return waitForValidToken()
  }

  /**
   * Use `nhost.graphql.request` to send a GraphQL request. For more serious GraphQL usage we recommend using a GraphQL client such as Apollo Client (https://www.apollographql.com/docs/react).
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
   * @docs https://docs.nhost.io/reference/javascript/graphql/request
   */
  request<T = any, V = Variables>(
    document: RequestDocument | TypedDocumentNode<T, V>,
    ...variablesAndRequestHeaders: V extends Record<any, never>
      ? [variables?: V, config?: NhostGraphqlRequestConfig]
      : keyof RemoveIndex<V> extends never
      ? [variables?: V, config?: NhostGraphqlRequestConfig]
      : [variables: V, config?: NhostGraphqlRequestConfig]
  ): Promise<NhostGraphqlRequestResponse<T>>
  async request<T = any, V extends Variables = Variables>(
    options: RequestOptions<V, T>
  ): Promise<NhostGraphqlRequestResponse<T>>
  async request<T = any, V extends Variables = Variables>(
    documentOrOptions: RequestDocument | TypedDocumentNode<T, V> | RequestOptions<V>,
    ...variablesAndRequestHeaders: V extends Record<any, never>
      ? [variables?: V, config?: NhostGraphqlRequestConfig]
      : keyof RemoveIndex<V> extends never
      ? [variables?: V, config?: NhostGraphqlRequestConfig]
      : [variables: V, config?: NhostGraphqlRequestConfig]
  ): Promise<NhostGraphqlRequestResponse<T>> {
    const [variables, config] = variablesAndRequestHeaders
    const requestOptions = parseRequestArgs(documentOrOptions, variables, config)

    const { headers, ...otherOptions } = config || {}
    const { query, operationName } = resolveRequestDocument(requestOptions.document)

    if (!process.env.TEST_MODE) {
      // We skip this while running unit tests because the accessToken is generated using faker
      await this.awaitForValidAccessToken()
    }

    try {
      const response = await fetch(this.httpUrl, {
        method: 'POST',
        body: JSON.stringify({
          operationName,
          query,
          variables
        }),
        headers: {
          'Content-Type': 'application/json',
          ...this.generateAccessTokenHeaders(),
          ...headers
        },
        ...otherOptions
      })
      if (!response.ok) {
        return {
          data: null,
          error: {
            error: response.statusText,
            message: response.statusText,
            status: response.status
          }
        }
      }
      const { data, errors } = await response.json()

      if (errors) {
        return {
          data: null,
          error: errors
        }
      }
      if (typeof data !== 'object' || Array.isArray(data) || data === null) {
        return {
          data: null,
          error: {
            error: 'invalid-response',
            message: 'incorrect response data from GraphQL server',
            status: 0
          }
        }
      }

      return { data, error: null }
    } catch (e) {
      const error = e as Error
      return {
        data: null,
        error: {
          message: error.message,
          status: error.name === 'AbortError' ? 0 : 500,
          error: error.name === 'AbortError' ? 'abort-error' : 'unknown'
        }
      }
    }
  }

  /**
   * Use `nhost.graphql.httpUrl` to get the GraphQL HTTP URL.
   * @example
   * ```ts
   * const url = nhost.graphql.httpUrl;
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/graphql/get-http-url
   */
  get httpUrl(): string {
    return this._url
  }

  /**
   * Use `nhost.graphql.wsUrl` to get the GraphQL WebSocket URL.
   * @example
   * ```ts
   * const url = nhost.graphql.wsUrl;
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/graphql/get-ws-url
   */
  get wsUrl(): string {
    return this._url.replace(/^(http)(s?):\/\//, 'ws$2://')
  }

  /**
   * Use `nhost.graphql.url` to get the GraphQL URL.
   * @deprecated Use `nhost.graphql.httpUrl` and `nhost.graphql.wsUrl` instead.
   */
  get url(): string {
    return this._url
  }

  /**
   * Use `nhost.graphql.getUrl()` to get the GraphQL URL.
   * @deprecated Use `nhost.graphql.httpUrl` and `nhost.graphql.wsUrl` instead.
   */
  getUrl(): string {
    return this._url
  }

  /**
   * Use `nhost.graphql.setAccessToken` to a set an access token to be used in subsequent graphql requests. Note that if you're signin in users with `nhost.auth.signIn()` the access token will be set automatically.
   *
   * @example
   * ```ts
   * nhost.graphql.setAccessToken('some-access-token')
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/graphql/set-access-token
   */
  setAccessToken(accessToken: string | undefined) {
    if (!accessToken) {
      this.accessToken = null
      return
    }

    this.accessToken = accessToken
  }

  private generateAccessTokenHeaders(): NhostGraphqlRequestConfig['headers'] {
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
