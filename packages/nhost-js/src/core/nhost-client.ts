import { HasuraAuthClient, NhostAuthConstructorParams } from '@nhost/hasura-auth-js'
import { HasuraStorageClient } from '@nhost/hasura-storage-js'

import { NhostFunctionsClient } from '../clients/functions'
import { NhostGraphqlClient } from '../clients/graphql'

type Params = Omit<NhostAuthConstructorParams, 'url'> & {
  /** Nhost backend url
   * @example https://my-app.nhost.run
   */
  backendUrl: string
  /** GraphQL endpoint. If given, it will take precedence over `backendUrl` */
  graphqlUrl?: string
  /** Hasura Auth endpoint. If given, it will take precedence over `backendUrl` */
  authUrl?: string
  /** Hasura Storage endpoint. If given, it will take precedence over `backendUrl` */
  storageUrl?: string
  /** Functions endpoint. If given, it will take precedence over `backendUrl` */
  functionsUrl?: string
}

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys]

export type NhostClientConstructorParams = RequireAtLeastOne<Params, 'backendUrl' | 'graphqlUrl'> &
  RequireAtLeastOne<Params, 'backendUrl' | 'authUrl'> &
  RequireAtLeastOne<Params, 'backendUrl' | 'storageUrl'> &
  RequireAtLeastOne<Params, 'backendUrl' | 'functionsUrl'>

export class NhostClient {
  auth: HasuraAuthClient
  storage: HasuraStorageClient
  functions: NhostFunctionsClient
  graphql: NhostGraphqlClient

  /**
   * Nhost Client
   *
   * @example
   * ```ts
   * const nhost = new NhostClient({ backendUrl: 'https://my-app.nhost.run' });
   * ```
   *
   * @docs https://docs.nhost.io/reference/sdk#installation
   */
  constructor({
    backendUrl,
    refreshIntervalTime,
    clientStorageGetter,
    clientStorageSetter,
    clientStorage,
    clientStorageType,
    autoRefreshToken,
    autoLogin,
    start = true,
    Client,
    ...customEndpoints
  }: NhostClientConstructorParams) {
    if (!backendUrl) {
      const missingUrls: string[] = ['graphqlUrl', 'authUrl', 'storageUrl', 'functionsUrl'].filter(
        (endpoint) => !customEndpoints[endpoint]
      )
      if (missingUrls.length) {
        throw new Error(
          `Cannot initialize client: \`backendUrl\` is not set, and the following options are not set either: ${missingUrls
            .map((url) => '`' + url + '`')
            .join(', ')}`
        )
      }
    }
    const { graphqlUrl, authUrl, storageUrl, functionsUrl } = customEndpoints
    this.auth = new HasuraAuthClient({
      url: authUrl || `${backendUrl}/v1/auth`,
      refreshIntervalTime,
      clientStorageGetter,
      clientStorageSetter,
      clientStorage,
      clientStorageType,
      autoRefreshToken,
      autoLogin,
      start,
      Client
    })

    this.storage = new HasuraStorageClient({
      url: storageUrl || `${backendUrl}/v1/storage`
    })

    this.functions = new NhostFunctionsClient({
      url: functionsUrl || `${backendUrl}/v1/functions`
    })

    this.graphql = new NhostGraphqlClient({
      url: graphqlUrl || `${backendUrl}/v1/graphql`
    })

    // * Set current token if token is already accessable
    this.storage.setAccessToken(this.auth.getAccessToken())
    this.functions.setAccessToken(this.auth.getAccessToken())
    this.graphql.setAccessToken(this.auth.getAccessToken())

    this.auth.client.onStart(() => {
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
  }
}
