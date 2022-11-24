import { NhostClientConstructorParams } from './types'

// a port can be a number or a placeholder string with leading and trailing double underscores, f.e. "8080" or "__PLACEHOLDER_NAME__"
const LOCALHOST_REGEX = /^((?<protocol>http[s]?):\/\/)?(?<host>localhost)(:(?<port>(\d+|__\w+__)))?$/

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

  // check if subdomain is [http[s]://]localhost[:port]
  const subdomainLocalhostFound = subdomain.match(LOCALHOST_REGEX)
  if (subdomainLocalhostFound?.groups) {
    const { protocol = 'http', host, port = 1337 } = subdomainLocalhostFound.groups

    const urlFromEnv = getValueFromEnv(service)
    if (urlFromEnv) {
      return urlFromEnv
    }
    return `${protocol}://${host}:${port}/v1/${service}`
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
