import { RedirectOption } from '../types'

/**
 * Encodes the given parameters as a query string and appends them to the given base URL.
 * Array values are encoded as comma-separated lists, and object values are encoded as JSON strings.
 * All parameter values are encoded using the `encodeURIComponent` function.
 * If no parameters are given, the base URL is returned unchanged.
 * @param baseUrl The base URL to which the encoded parameters will be appended.
 * @param parameters An optional object containing the parameters to encode.
 * @returns The base URL with the encoded parameters appended as a query string.
 */
export const encodeQueryParameters = (
  baseUrl: string,
  parameters?: Record<string, unknown>
): string => {
  const encodedParameters = parameters
    ? Object.entries(parameters)
        .map(([key, value]) => {
          const stringValue: string = Array.isArray(value)
            ? value.join(',')
            : typeof value === 'object'
            ? JSON.stringify(value)
            : (value as string)
          return `${key}=${encodeURIComponent(stringValue)}`
        })
        .join('&')
    : ''
  return encodedParameters ? `${baseUrl}?${encodedParameters}` : baseUrl
}

/**
 * Transform options that include a redirectTo property so the
 * redirect url is absolute, given a base clientUrl.
 * If no client url is given, any relative redirectUrl is removed while
 * the other options are sent as-is.
 * @param clientUrl base client url
 * @param options
 * @returns
 */
export const rewriteRedirectTo = <T extends RedirectOption>(
  clientUrl?: string,
  options?: T
): (Omit<T, 'redirectTo'> & { redirectTo?: string }) | undefined => {
  if (!options?.redirectTo) {
    return options
  }
  const { redirectTo, ...otherOptions } = options
  // * If the clientUrl is not defined, we can't rewrite the redirectTo
  if (!clientUrl) {
    // * If redirectTo is a relative path, we therefore pull it out of the options
    if (redirectTo.startsWith('/')) {
      return otherOptions
    } else {
      return options
    }
  }
  const baseClientUrl = new URL(clientUrl)
  const clientParams = Object.fromEntries(new URLSearchParams(baseClientUrl.search))
  const url = new URL(redirectTo.startsWith('/') ? baseClientUrl.origin + redirectTo : redirectTo)
  const additionalParams = new URLSearchParams(url.search)
  let combinedParams = Object.fromEntries(additionalParams)

  if (redirectTo.startsWith('/')) {
    combinedParams = { ...clientParams, ...combinedParams }
  }
  let pathName = baseClientUrl.pathname
  if (url.pathname.length > 1) {
    pathName += url.pathname.slice(1)
  }
  return {
    ...otherOptions,
    redirectTo: encodeQueryParameters(url.origin + pathName, combinedParams)
  }
}

/**
 * Extracts the value of a named parameter from the given URL. The parameter may be located in either the
 * search parameters or the hash parameters of the URL. If the parameter is not found, the function returns
 * `null`. If the parameter is found but has an empty string value, the function returns an empty string.
 * @param name The name of the parameter to extract.
 * @param url The URL from which to extract the parameter value. If not provided, the current window location
 * URL is used.
 * @returns The value of the named parameter, or an empty string if the parameter has an empty string value,
 * or `null` if the parameter is not found.
 */
export function getParameterByName(name: string, url = window.location?.href || '') {
  // Try to extract the parameter value from the search parameters
  const searchParams = new URLSearchParams(url.split('?')[1] || '')
  let value = searchParams.get(name)

  // If the parameter is not found in the search parameters, try the hash parameters
  if (value === null) {
    const hashSearchParams = new URLSearchParams(url.split('#')[1] || '')
    value = hashSearchParams.get(name)
  }

  // Return the parameter value, or an empty string if it is an empty string, or null if it is not found
  return value === '' ? '' : value?.split('#')[0] || null
}

/**
 * Removes the specified parameter from the current window location URL. If the parameter is present in the
 * search parameters or the hash parameters of the URL, it is removed. The modified URL is then pushed to
 * the browser history, so that it becomes the current URL. If the parameter is not found in the URL, the
 * function does nothing.
 * @param name The name of the parameter to remove from the current window location URL.
 */
export function removeParameterFromWindow(name: string) {
  if (typeof global.window === 'undefined') return

  const { location } = global.window
  if (!location) return

  const search = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash?.slice(1))
  search.delete(name)
  hash.delete(name)

  let url = window.location.pathname
  if (search.toString()) url += `?${search.toString()}`
  if (hash.toString()) url += `#${hash.toString()}`

  window.history.pushState({}, '', url)
}
