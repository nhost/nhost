import { NhostClientConstructorParams } from './types'

const LOCALHOST_REGEX = /^localhost(:\d+)*$/g

/**
 * `backendUrl` should now be used only when self-hosting
 * `subdomain` and `region` should be used instead when using the Nhost platform
 * `
 * @param backendOrSubdomain
 * @param service
 * @returns
 */
export function urlFromSubdomain(
  backendOrSubdomain: Pick<NhostClientConstructorParams, 'region' | 'subdomain' | 'backendUrl'>,
  service: string
): string {
  const { backendUrl, subdomain, region } = backendOrSubdomain

  if (backendUrl) {
    return `${backendUrl}/v1/${service}`
  }

  if (!subdomain) {
    throw new Error('Either `backendUrl` or `subdomain` must be set.')
  }

  // check if subdomain is localhost[:port]
  const subdomainLocalhostFound = subdomain.match(LOCALHOST_REGEX)
  if (subdomainLocalhostFound && subdomainLocalhostFound.length > 0) {
    const localhostFound = subdomainLocalhostFound[0]

    // no port specified, use standard port 1337
    const urlFromEnv = getValueFromEnv(service)
    if (localhostFound === 'localhost' && urlFromEnv) {
      return urlFromEnv
    }

    if (localhostFound === 'localhost') {
      return `http://localhost:1337/v1/${service}`
    }

    // port specified
    return `http://${localhostFound}/v1/${service}`
  }

  if (!region) {
    throw new Error('`region` must be set when using a `subdomain` other than "localhost".')
  }

  return `https://${subdomain}.${service}.${region}.nhost.run/v1`
}

/**
 *
 * @returns whether the code is running in a browser
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/**
 *
 * @returns whether the code is running in a Node.js environment
 */
function environmentIsAvailable() {
  return typeof process !== 'undefined' && process.env
}

/**
 *
 * @param service auth | storage | graphql | functions
 * @returns the service's url if the corresponding env var is set
 * NHOST_${service}_URL
 */
function getValueFromEnv(service: string) {
  if (isBrowser() || !environmentIsAvailable()) {
    return null
  }

  return process.env[`NHOST_${service.toUpperCase()}_URL`]
}
