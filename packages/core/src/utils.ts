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

export const rewriteRedirectTo = (
  clientUrl: string,
  options?: Record<string, unknown> & { redirectTo?: string }
) =>
  options?.redirectTo
    ? {
        ...options,
        redirectTo: options?.redirectTo?.startsWith('/')
          ? clientUrl + options.redirectTo
          : options?.redirectTo
      }
    : options
