import { HasuraStorageClient } from '@nhost/hasura-storage-js'

import { urlFromSubdomain } from '../utils/helpers'
import { NhostClientConstructorParams } from '../utils/types'

/**
 * Creates a client for Storage from either a subdomain or a URL
 */
export function createStorageClient(params: NhostClientConstructorParams) {
  const storageUrl = 'subdomain' in params ? urlFromSubdomain(params, 'storage') : params.storageUrl

  if (!storageUrl) {
    throw new Error('Please provide `subdomain` or `storageUrl`.')
  }

  return new HasuraStorageClient({ url: storageUrl, ...params })
}
