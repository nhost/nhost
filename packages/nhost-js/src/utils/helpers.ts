import { BackendOrSubdomain } from './types'

const LOCALHOST = /^localhost(:\d+)*$/

/**
 * `backendUrl` will be deprecated in favor of `subdomain` and `region`
 * @param backendOrSubdomain
 * @param service
 * @returns
 */
export function urlFromParams(backendOrSubdomain: BackendOrSubdomain, service: string) {
  if ('backendUrl' in backendOrSubdomain) {
    return `${backendOrSubdomain.backendUrl}/v1/${service}`
  }

  if (backendOrSubdomain.subdomain.match(LOCALHOST)) {
    return `http://${backendOrSubdomain.subdomain}/v1/${service}`
  }

  if (!('region' in backendOrSubdomain)) {
    throw new Error('A region must be specified when using a `subdomain` other than "localhost".')
  }

  return `https://${backendOrSubdomain.subdomain}.${service}.${backendOrSubdomain.region}.nhost.run/v1`
}
