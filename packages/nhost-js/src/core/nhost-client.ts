import { HasuraAuthClient } from '@nhost/hasura-auth-js'
import { HasuraStorageClient } from '@nhost/hasura-storage-js'

import { NhostFunctionsClient } from '../clients/functions'
import { NhostGraphqlClient } from '../clients/graphql'
import { urlFromParams } from '../utils/helpers'
import { NhostClientConstructorParams } from '../utils/types'

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
    this.auth = new HasuraAuthClient({
      url: urlFromParams(urlParams, 'auth'),
      refreshIntervalTime,
      clientStorageGetter,
      clientStorageSetter,
      clientStorage,
      clientStorageType,
      autoRefreshToken,
      autoSignIn,
      start
    })

    this.storage = new HasuraStorageClient({
      url: urlFromParams(urlParams, 'storage'),
      adminSecret
    })

    this.functions = new NhostFunctionsClient({
      url: urlFromParams(urlParams, 'functions'),
      adminSecret
    })

    this.graphql = new NhostGraphqlClient({
      url: urlFromParams(urlParams, 'graphql'),
      adminSecret
    })

    // * Set current token if token is already accessable
    this.storage.setAccessToken(this.auth.getAccessToken())
    this.functions.setAccessToken(this.auth.getAccessToken())
    this.graphql.setAccessToken(this.auth.getAccessToken())

    this.auth.client?.onStart(() => {
      // * Set access token when signing out
      this.auth.onAuthStateChanged((_event, session) => {
        if (_event === 'SIGNED_OUT') {
          this.storage.setAccessToken(undefined)
          this.functions.setAccessToken(undefined)
          this.graphql.setAccessToken(undefined)
        }
      })

      // * Update access token for clients, including when signin in
      this.auth.onTokenChanged((session) => {
        this.storage.setAccessToken(session?.accessToken)
        this.functions.setAccessToken(session?.accessToken)
        this.graphql.setAccessToken(session?.accessToken)
      })
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
