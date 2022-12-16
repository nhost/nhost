import { HasuraAuthClient } from '@nhost/hasura-auth-js'
import { HasuraStorageClient } from '@nhost/hasura-storage-js'
import { NhostClientConstructorParams } from '../utils/types'
import { createAuthClient } from './auth'
import { createFunctionsClient, NhostFunctionsClient } from './functions'
import { createGraphqlClient, NhostGraphqlClient } from './graphql'
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
   * Nhost Client
   *
   * @example
   * ```ts
   * const nhost = new NhostClient({ subdomain, region });
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript
   */
  constructor({
    refreshIntervalTime,
    clientStorageGetter,
    clientStorageSetter,
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
      clientStorageGetter,
      clientStorageSetter,
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

    this.auth.onAuthStateChanged((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        this.storage.setAccessToken(undefined)
        this.functions.setAccessToken(undefined)
        this.graphql.setAccessToken(undefined)
      }
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
}
