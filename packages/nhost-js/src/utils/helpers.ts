import { NhostClientConstructorParams } from './types'

const LOCALHOST = /^localhost(:\d+)*$/

/**
 * `backendUrl` should now be used only when self-hosting
 * `subdomain` and `region` should be used instead when using the Nhost platform
 * `
 * @param backendOrSubdomain
 * @param service
 * @returns
 */
export function urlFromParams(
  backendOrSubdomain: Pick<NhostClientConstructorParams, 'region' | 'subdomain' | 'backendUrl'>,
  service: string
) {
  if ('backendUrl' in backendOrSubdomain) {
    return `${backendOrSubdomain.backendUrl}/v1/${service}`
  }

  if (backendOrSubdomain.subdomain !== undefined && backendOrSubdomain.subdomain.match(LOCALHOST)) {
    return backendOrSubdomain === 'localhost'
      ? `http://localhost:1337/v1/${service}`
      : `http://${backendOrSubdomain.subdomain}/v1/${service}`
  }

  if (!('region' in backendOrSubdomain)) {
    throw new Error('A region must be specified when using a `subdomain` other than "localhost".')
  }

  return `https://${backendOrSubdomain.subdomain}.${service}.${backendOrSubdomain.region}.nhost.run/v1`
}
