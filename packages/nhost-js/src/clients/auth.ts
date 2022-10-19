import { getHasuraAuthClient } from '@nhost/hasura-auth-js'

import { getAuthUrlFromEnv, urlFromParams } from '../utils/helpers'

/**
 * Get a client for Auth
 *
 * @param refreshIntervalTime
 * @param clientStorageGetter
 * @param clientStorageSetter
 * @param clientStorage
 * @param clientStorageType
 * @param autoRefreshToken
 * @param autoSignIn
 * @param start
 * @param urlParams
 * @returns
 */
export function getAuthClient(
  refreshIntervalTime: number | undefined,
  clientStorageGetter: any,
  clientStorageSetter: any,
  clientStorage: any,
  clientStorageType: any,
  autoRefreshToken: any,
  autoSignIn: any,
  start: any,
  urlParams: any
) {
  // use process.env.AUTH_URL if set
  const authUrl = getAuthUrlFromEnv() ?? urlFromParams(urlParams, 'auth')

  return getHasuraAuthClient(
    authUrl,
    refreshIntervalTime,
    clientStorageGetter,
    clientStorageSetter,
    clientStorage,
    clientStorageType,
    autoRefreshToken,
    autoSignIn,
    start
  )
}
