import { HasuraAuthClient, NhostAuthConstructorParams } from '@nhost/hasura-auth-js'
import { HasuraStorageClient } from '@nhost/hasura-storage-js'

import { NhostFunctionsClient } from '../clients/functions'
import { NhostGraphqlClient } from '../clients/graphql'

export interface NhostClientConstructorParams extends Omit<NhostAuthConstructorParams, 'url'> {
  /**
   * Nhost backend URL
   * Will be deprecated in favor of `subdomain` and `region`
   */
  backendUrl?: string

  /**
   * App subdomain (e.g., ifieniwenfiwenwng)
   * Use `localhost` in development
   */
  subdomain?: string

  /**
   * App region (e.g. eu-central-1)
   * Optional in development
   */
  region?: string
}

export class NhostClient {
  auth: HasuraAuthClient
  storage: HasuraStorageClient
  functions: NhostFunctionsClient
  graphql: NhostGraphqlClient
  readonly devTools?: boolean

  /**
   * Nhost Client
   *
   * @example
   * const nhost = new NhostClient({ subdomain, region });
   *
   * @docs https://docs.nhost.io/reference/javascript
   */
  constructor({
    backendUrl,
    subdomain,
    region,
    refreshIntervalTime,
    clientStorageGetter,
    clientStorageSetter,
    clientStorage,
    clientStorageType,
    autoRefreshToken,
    autoSignIn,
    devTools,
    start = true
  }: NhostClientConstructorParams) {
    if (!backendUrl && !subdomain)
      throw new Error('Please specify either `backendUrl` or `subdomain`. Docs: [todo]!')

    if (subdomain && subdomain !== 'localhost' && !region)
      throw new Error('`region` is required when using `subdomain` (except for "localhost").')

    const urlFromEnv = (
      backendUrl?: string,
      subdomain?: string,
      region?: string,
      service?: string
    ) => {
      if (backendUrl) return `${backendUrl}/v1/${service}`

      if (subdomain === 'localhost') return `http://${subdomain}`

      return `${subdomain}.${service}.${region}.nhost.run/v1`
    }

    this.auth = new HasuraAuthClient({
      url: urlFromEnv(backendUrl, subdomain, region, 'auth'),
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
      url: urlFromEnv(backendUrl, subdomain, region, 'storage')
    })

    this.functions = new NhostFunctionsClient({
      url: urlFromEnv(backendUrl, subdomain, region, 'functions')
    })

    this.graphql = new NhostGraphqlClient({
      url: urlFromEnv(backendUrl, subdomain, region, 'graphql')
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
    this.devTools = devTools
  }
}
