export const encodeQueryParameters = (baseUrl: string, parameters?: Record<string, unknown>) => {
  const encodedParameters =
    parameters &&
    Object.entries(parameters)
      .map((key, value) => {
        const stringValue = Array.isArray(value)
          ? value.join(',')
          : typeof value === 'object'
          ? JSON.stringify(value)
          : value
        return `${key}=${encodeURIComponent(stringValue)}`
      })
      .join('&')
  if (encodedParameters) return `${baseUrl}?${encodedParameters}`
  else return baseUrl
}
