import { HasuraAuthClient } from '@nhost/hasura-auth-js'

import { urlFromSubdomain } from '../utils/helpers'
import { NhostClientConstructorParams } from '../utils/types'

/**
 * Creates a client for Auth from either a subdomain or a URL
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
export function createAuthClient(params: NhostClientConstructorParams) {
  const authUrl =
    'subdomain' in params || 'backendUrl' in params
      ? urlFromSubdomain(params, 'auth')
      : params.authUrl

  if (!authUrl) {
    throw new Error('Please provide `subdomain` or `authUrl`.')
  }

  return new HasuraAuthClient({
    ...params,
    url: authUrl
  })
}
