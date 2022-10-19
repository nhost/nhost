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
  // use process.env.STORAGE_URL if set
  const storageUrl = getStorageUrlFromEnv() ?? urlFromParams(urlParams, 'storage')

  return getHasuraStorageClient(storageUrl, adminSecret)
}
