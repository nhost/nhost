import { NhostClientConstructorParams } from './types'

// a port can be a number or a placeholder string with leading and trailing double underscores, f.e. "8080" or "__PLACEHOLDER_NAME__"
export const LOCALHOST_REGEX =
  /^((?<protocol>http[s]?):\/\/)?(?<host>(localhost|local))(:(?<port>(\d+|__\w+__)))?$/

/**
 * \`subdomain\` and `region` should be used when running the Nhost platform
 *
 * @param subdomainAndRegion
 * @param service
 * @returns
 */
export function urlFromSubdomain(
  subdomainAndRegion: Pick<NhostClientConstructorParams, 'region' | 'subdomain'>,
  service: string
): string {
  const { subdomain, region } = subdomainAndRegion

  if (!subdomain) {
    throw new Error('A `subdomain` must be set.')
  }

  // check if subdomain is [http[s]://]localhost[:port] or [http[s]://]local[:port]
  const subdomainLocalhostFound = subdomain.match(LOCALHOST_REGEX)
  if (subdomainLocalhostFound?.groups) {
    const { protocol, host, port } = subdomainLocalhostFound.groups

    const urlFromEnv = getValueFromEnv(service)
    if (urlFromEnv) {
      return urlFromEnv
    }

    if (host === 'localhost') {
      console.warn(
        'The `subdomain` is set to "localhost". Support for this will be removed in a future release. Please use "local" instead.'
      )

      return `${protocol || 'http'}://localhost:${port || 1337}/v1/${service}`
    }

    return port
      ? `${protocol || 'https'}://local.${service}.nhost.run:${port}/v1`
      : `${protocol || 'https'}://local.${service}.nhost.run/v1`
  }

  if (!region) {
    throw new Error('`region` must be set when using a `subdomain` other than "local".')
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

/**
 * Combines a base URL and a path into a single URL string.
 *
 * @param baseUrl - The base URL to use.
 * @param path - The path to append to the base URL.
 * @returns The combined URL string.
 */
export function buildUrl(baseUrl: string, path: string) {
  const hasLeadingSlash = path.startsWith('/')
  const urlPath = hasLeadingSlash ? path : `/${path}`
  return baseUrl + urlPath
}
