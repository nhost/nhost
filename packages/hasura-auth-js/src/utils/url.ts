import { RedirectOption } from '../types'

export const encodeQueryParameters = (baseUrl: string, parameters?: Record<string, unknown>) => {
  const encodedParameters =
    parameters &&
    Object.entries(parameters)
      .map(([key, value]) => {
        const stringValue = Array.isArray(value)
          ? value.join(',')
          : typeof value === 'object'
          ? JSON.stringify(value)
          : (value as string)
        return `${key}=${encodeURIComponent(stringValue)}`
      })
      .join('&')
  if (encodedParameters) return `${baseUrl}?${encodedParameters}`
  else return baseUrl
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

export function getParameterByName(name: string, url?: string) {
  if (!url) {
    if (typeof window === 'undefined') {
      return
    }
    url = window.location?.href || ''
  }
  // eslint-disable-next-line no-useless-escape
  name = name.replace(/[\[\]]/g, '\\$&')
  const regex = new RegExp('[?&#]' + name + '(=([^&#]*)|&|#|$)'),
    results = regex.exec(url)
  if (!results) return null
  if (!results[2]) return ''
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

export function removeParameterFromWindow(name: string) {
  if (typeof window === 'undefined') {
    return
  }
  const location = window?.location
  if (!location) {
    return
  }
  if (location) {
    const search = new URLSearchParams(location.search)
    const hash = new URLSearchParams(location.hash?.slice(1))
    search.delete(name)
    hash.delete(name)
    let url = window.location.pathname
    if (Array.from(search).length) url += `?${search.toString()}`
    if (Array.from(hash).length) url += `#${hash.toString()}`
    window.history.pushState({}, '', url)
  }
}
