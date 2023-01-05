export * from './types'

/** Convert any string into ISO-8859-1 */
export const toIso88591 = (fileName: string) => {
  try {
    btoa(fileName)
    return fileName
  } catch {
    return encodeURIComponent(fileName)
  }
}
