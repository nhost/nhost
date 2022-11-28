import { GraphQLClient } from 'graphql-request'

import { urlFromSubdomain } from '../utils/helpers'
import { NhostClientConstructorParams } from '../utils/types'

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
 * Creates a client for GraphQL from either a subdomain or a URL
 */
export function createGraphqlClient(params: NhostClientConstructorParams) {
  const graphqlUrl =
    'subdomain' in params || 'backendUrl' in params
      ? urlFromSubdomain(params, 'graphql')
      : params.graphqlUrl

  if (!graphqlUrl) {
    throw new Error('Please provide `subdomain` or `graphqlUrl`.')
  }

  return new NhostGraphqlClient({ url: graphqlUrl, ...params })
}

/**
 * @alias GraphQL
 */
export class NhostGraphqlClient extends GraphQLClient {
  // this.url is already defined as a private property in GraphQLClient
  private _url: string
  private accessToken: string | null = null
  private adminSecret: string | null = null

  constructor({ url, adminSecret }: NhostGraphqlConstructorParams) {
    super(url)

    this._url = url
    this.setEndpoint(url)

    if (adminSecret) {
      this.adminSecret = adminSecret
    }

    this.resetHeaders()
  }

  /**
   * Use `nhost.graphql.getUrl` to get the GraphQL URL.
   * @deprecated Use `nhost.graphql.httpUrl` and `nhost.graphql.wsUrl` instead.
   * @example
   * ```ts
   * const url = nhost.graphql.getUrl();
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/nhost-js/graphql/get-url
   */
  getUrl(): string {
    return this._url
  }

  /**
   * Use `nhost.graphql.httpUrl` to get the GraphQL HTTP URL.
   * @example
   * ```ts
   * const url = nhost.graphql.httpUrl;
   * ```
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
   */
  get wsUrl(): string {
    return this._url.replace(/^(http)(s?):\/\//, 'ws$2://')
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
    this.accessToken = accessToken || null
    this.resetHeaders()
  }

  setEndpoint(value: string): GraphQLClient {
    this._url = value
    super.setEndpoint(value)
    return this
  }

  setHeaders(value: Record<string, string>): GraphQLClient {
    super.setHeaders({ ...this.generateAccessTokenHeaders(), ...value })
    return this
  }

  private resetHeaders() {
    this.setHeaders(this.generateAccessTokenHeaders())
  }

  private generateAccessTokenHeaders(): Record<string, string> {
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
