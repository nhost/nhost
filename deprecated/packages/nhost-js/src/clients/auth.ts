import { HasuraAuthClient } from '@nhost/hasura-auth-js'

import { urlFromSubdomain } from '../utils/helpers'
import { NhostClientConstructorParams } from '../utils/types'

/**
 * Creates a client for Auth from either a subdomain or a URL
 */
export function createAuthClient(params: NhostClientConstructorParams) {
  const authUrl = 'subdomain' in params ? urlFromSubdomain(params, 'auth') : params.authUrl

  const { subdomain, region } = params

  if (!authUrl) {
    throw new Error('Please provide `subdomain` or `authUrl`.')
  }

  return new HasuraAuthClient({
    url: authUrl,
    broadcastKey: `${subdomain}${region ?? 'local'}`,
    ...params
  })
}
