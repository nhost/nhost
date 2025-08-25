import { NhostGraphqlClient } from '@nhost/graphql-js'
import { HasuraAuthClient } from '@nhost/hasura-auth-js'
import { HasuraStorageClient } from '@nhost/hasura-storage-js'
import { NhostClientConstructorParams } from '../utils/types'
import { createAuthClient } from './auth'
import { createFunctionsClient, NhostFunctionsClient } from './functions'
import { createGraphqlClient } from './graphql'
import { createStorageClient } from './storage'

export const createNhostClient = (params: NhostClientConstructorParams) => new NhostClient(params)

export class NhostClient {
  auth: HasuraAuthClient
  storage: HasuraStorageClient
  functions: NhostFunctionsClient
  graphql: NhostGraphqlClient
  private _adminSecret?: string
  readonly devTools?: boolean

  /**
   *
   * @example
   * ```ts
   * // Create a new Nhost client from subdomain and region.
   * const nhost = new NhostClient({ subdomain, region });
   * ```
   *
   *
   * ```ts
   * // Create a new Nhost client from individual service URLs (custom domains, self-hosting, etc).
   * const nhost = new NhostClient({
   *   authUrl: "my-auth-service-url",
   *   storageUrl: "my-storage-service-url",
   *   graphqlUrl: "my-graphql-service-url",
   *   functionsUrl: "my-functions-service-url",
   * });
   * ```
   *
   *
   * ```ts
   * // Create a new Nhost client for local development.
   * const nhost = new NhostClient({ subdomain: "local" });
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript
   */
  constructor({
    refreshIntervalTime,
    clientStorage,
    clientStorageType,
    autoRefreshToken,
    autoSignIn,
    adminSecret,
    devTools,
    start = true,
    ...urlParams
  }: NhostClientConstructorParams) {
    // * Set clients for all services
    this.auth = createAuthClient({
      refreshIntervalTime,
      clientStorage,
      clientStorageType,
      autoRefreshToken,
      autoSignIn,
      start,
      ...urlParams
    })
    this.storage = createStorageClient({ adminSecret, ...urlParams })
    this.functions = createFunctionsClient({ adminSecret, ...urlParams })
    this.graphql = createGraphqlClient({ adminSecret, ...urlParams })

    this.auth.onAuthStateChanged((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.storage.setAccessToken(undefined)
        this.functions.setAccessToken(undefined)
        this.graphql.setAccessToken(undefined)

        return
      }

      const accessToken = session?.accessToken
      this.storage.setAccessToken(accessToken)
      this.functions.setAccessToken(accessToken)
      this.graphql.setAccessToken(accessToken)
    })

    // * Update access token for clients, including when signin in
    this.auth.onTokenChanged((session) => {
      const accessToken = session?.accessToken
      this.storage.setAccessToken(accessToken)
      this.functions.setAccessToken(accessToken)
      this.graphql.setAccessToken(accessToken)
    })

    this._adminSecret = adminSecret
    this.devTools = devTools
  }

  get adminSecret(): string | undefined {
    return this._adminSecret
  }

  set adminSecret(newValue: string | undefined) {
    this._adminSecret = newValue
    this.storage.setAdminSecret(newValue)
    // TODO inconsistent API: storage can change admin secret, but functions/graphql cannot
    // this.functions.setAdminSecret(newValue)
    // this.graphql.setAdminSecret(newValue)
  }

  /**
   * Use `nhost.setRole` to set the user role for all subsequent GraphQL, storage, and functions calls.
   * Underneath, this method sets the `x-hasura-role` header on the graphql, storage,
   * and functions clients.
   *
   * ```ts
   * nhost.graphql.setHeaders({ 'x-hasura-role': role })
   * nhost.storage.setHeaders({ 'x-hasura-role': role })
   * nhost.functions.setHeaders({ 'x-hasura-role': role })
   * ```
   *
   * Note: Exercise caution when mixing the use of `setRole` along with `setHeaders` when setting the
   * `x-hasura-role` header, as the last call will override any previous ones.
   *
   * @example
   * ```ts
   * nhost.setRole('admin')
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/nhost-js/set-role
   */
  setRole(role: string) {
    this.graphql.setHeaders({ 'x-hasura-role': role })
    this.storage.setHeaders({ 'x-hasura-role': role })
    this.functions.setHeaders({ 'x-hasura-role': role })
  }

  /**
   * Use `nhost.unsetRole` to unset the user role for all subsequent graphql, storage and functions calls.
   * Underneath, this method removes the `x-hasura-role` header from the graphql, storage and functions clients.
   *
   * Note: Exercise caution when mixing the use of `unsetRole` along with `setHeaders` when setting the
   * `x-hasura-role` header, as the last call will override any previous ones.
   *
   * @example
   * ```ts
   * nhost.unsetRole()
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/nhost-js/unset-role
   */
  unsetRole() {
    this.graphql.setHeaders((({ 'x-hasura-role': _, ...rest }) => rest)(this.graphql.getHeaders()))
    this.storage.setHeaders((({ 'x-hasura-role': _, ...rest }) => rest)(this.storage.getHeaders()))
    this.functions.setHeaders(
      (({ 'x-hasura-role': _, ...rest }) => rest)(this.functions.getHeaders())
    )
  }
}
