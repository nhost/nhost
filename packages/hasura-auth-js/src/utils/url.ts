import { RedirectOption } from '../types'

export const encodeQueryParameters = (
  baseUrl: string,
  parameters?: Record<string, unknown>,
  hash?: string
) => {
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
  const url = encodedParameters ? `${baseUrl}?${encodedParameters}` : baseUrl
  return hash ? url + hash : url
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

  const url = new URL(
    redirectTo.startsWith('/')
      ? baseClientUrl.origin + redirectTo
      : redirectTo.startsWith('#')
      ? baseClientUrl.origin
      : redirectTo
  )
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
    redirectTo: encodeQueryParameters(
      url.origin + pathName,
      combinedParams,
      redirectTo.startsWith('#') ? redirectTo : undefined
    )
  }
}

export function getParameterByName(name: string) {
  if (typeof window === 'undefined') {
    return
  }
  const url = window.location?.href || ''
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
    search.delete(name)
    let url = window.location.pathname
    if (Array.from(search).length) {
      url += `?${search.toString()}`
    }

    const hash = new URLSearchParams(location.hash?.slice(1))
    /** @deprecated refresh tokens and types are not send in the hash anymore */
    if (hash.get(name)) {
      hash.delete(name)
      url += `#${hash.toString()}`
    } else {
      if (location.hash) {
        url += location.hash
      }
    }

    window.history.pushState({}, '', url)
  }
}
