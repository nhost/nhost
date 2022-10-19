import { getHasuraStorageClient } from '@nhost/hasura-storage-js'

import { getStorageUrlFromEnv, urlFromParams } from '../utils/helpers'

/**
 * Get a client for Storage
 *
 * @param adminSecret
 * @param urlParams
 *
 */
export function getStorageClient(adminSecret: string | undefined, urlParams: any) {
  const storageUrl = urlFromParams(urlParams, 'storage')
  const storageUrlFromEnv = getStorageUrlFromEnv()

  return getHasuraStorageClient(storageUrlFromEnv ? storageUrlFromEnv : storageUrl, adminSecret)
}
