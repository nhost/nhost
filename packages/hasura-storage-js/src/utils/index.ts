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
