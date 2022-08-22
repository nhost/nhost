import { NhostClientConstructorParams } from './types'

const LOCALHOST_REGEX = /^localhost(:\d+)*$/

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
  const { backendUrl, subdomain, region } = backendOrSubdomain

  if (!backendUrl && !subdomain) {
    throw new Error('Either `backendUrl` or `subdomain` must be set.')
  }

  // if backendUrl is set, use it.
  if (backendUrl) {
    return `${backendUrl}/v1/${service}`
  }

  // to make TS happy
  if (!subdomain) {
    throw new Error('`subdomain` must be set if `backendUrl` is not set.')
  }

  // check if subdomain is localhost
  const subdomainLocalhostFound = subdomain.match(LOCALHOST_REGEX)
  if (subdomainLocalhostFound && subdomainLocalhostFound.length > 0) {
    return `http://${subdomainLocalhostFound[0]}/v1/${service}`
  }

  // subdomain is set, but not to "localhost". `region` must be set.
  if (!region) {
    throw new Error('`region` must be set when using a `subdomain` other than "localhost".')
  }

  return `https://${subdomain}.${service}.${region}.nhost.run/v1`
}
