import { StorageImageTransformationParams } from './types'

export * from './types'

export const appendImageTransformationParameters = (
  url: string,
  params: StorageImageTransformationParams
): string => {
  const queryParameters = Object.entries(params)
    .map(([key, value]) => `${Array.from(key)[0]}=${value}`)
    .join('&')
  return queryParameters ? `${url}?${queryParameters}` : url
}

/** Convert any string into ISO-8859-1 */
export const toIso88591 = (fileName: string) => {
  try {
    btoa(fileName)
    return fileName
  } catch {
    return encodeURIComponent(fileName)
  }
}
