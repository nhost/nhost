import { StorageImageTransformationParams } from '../types'

/**
 * Appends image transformation parameters to the URL. If the URL already
 * contains query parameters, the transformation parameters are appended to
 * the existing query parameters.
 *
 * @internal
 * @param url - The URL to append the transformation parameters to.
 * @param params - The image transformation parameters.
 * @returns The URL with the transformation parameters appended.
 */
export default function appendImageTransformationParameters(
  url: string,
  params?: StorageImageTransformationParams
): string {
  if (!params || Object.keys(params).length === 0) {
    return url
  }

  const urlObject = new URL(url)

  // create an object with the transformation parameters by using the first
  // character of the parameter name as the key
  const imageTransformationParams = Object.entries(params).reduce(
    (accumulator, [key, value]) => ({ ...accumulator, [key.charAt(0)]: value }),
    {} as Record<string, any>
  )

  // set the query parameters in the URL object
  Object.entries(imageTransformationParams).forEach(([key, value]) => {
    if (!value) {
      return
    }

    urlObject.searchParams.set(key, value)
  })

  return urlObject.toString()
}
