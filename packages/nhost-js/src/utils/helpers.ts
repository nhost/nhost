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
export function urlFromParams(
  backendOrSubdomain: Pick<NhostClientConstructorParams, 'region' | 'subdomain' | 'backendUrl'>,
  service: string
) {
  const { backendUrl, subdomain, region } = backendOrSubdomain

  if (!backendUrl && !subdomain) {
    throw new Error('Either `backendUrl` or `subdomain` must be set.')
  }

  if (backendUrl) {
    return `${backendUrl}/v1/${service}`
  }

  // to make TS happy
  if (!subdomain) {
    throw new Error('`subdomain` must be set if `backendUrl` is not set.')
  }

  // check if subdomain is localhost[:port]
  const subdomainLocalhostFound = subdomain.match(LOCALHOST_REGEX)
  if (subdomainLocalhostFound && subdomainLocalhostFound.length > 0) {
    const localhostFound = subdomainLocalhostFound[0]

    // no port specified, use standard port 1337
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
 * @returns process.env.AUTH_URL if set, null otherwise
 */
export function getAuthUrlFromEnv(): string | null {
  if (!isBrowser() && environmentIsAvailable()) {
    return process.env.AUTH_URL ? process.env.AUTH_URL : null
  }

  return null
}

/**
 *
 * @returns process.env.STORAGE_URL if set, null otherwise
 */
export function getStorageUrlFromEnv(): string | null {
  if (!isBrowser() && environmentIsAvailable()) {
    return process.env.STORAGE_URL ? process.env.STORAGE_URL : null
  }

  return null
}

/**
 *
 * @returns process.env.FUNCTIONS_URL if set, null otherwise
 */
export function getFunctionsUrlFromEnv(): string | null {
  if (!isBrowser() && environmentIsAvailable()) {
    return process.env.FUNCTIONS_URL ? process.env.FUNCTIONS_URL : null
  }

  return null
}

/**
 *
 * @returns process.env.GRAPHQL_URL if set, null otherwise
 */
export function getGraphqlUrlFromEnv(): string | null {
  if (!isBrowser() && environmentIsAvailable()) {
    return process.env.GRAPHQL_URL ? process.env.GRAPHQL_URL : null
  }

  return null
}
