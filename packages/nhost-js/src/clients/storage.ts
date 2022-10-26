import { createHasuraStorageClient } from '@nhost/hasura-storage-js'

import { urlFromSubdomain } from '../utils/helpers'

/**
 * Creates a client for Storage from either a subdomain or a URL
 *
 * @param adminSecret
 * @param urlParams
 *
 */
export function createStorageClient(adminSecret: string | undefined, urlParams: any) {
  const storageUrl =
    'subdomain' in urlParams || 'backendUrl' in urlParams
      ? urlFromSubdomain(urlParams, 'storage')
      : urlParams.storageUrl

  if (!storageUrl) {
    throw new Error('Please provide `subdomain` or `storageUrl`.')
  }

  return createHasuraStorageClient(storageUrl, adminSecret)
}
