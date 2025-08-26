/**
 * Joins a number of URLs together by removing the last part of the first URL if it matches the first part
 * of the next URL.
 *
 * @param urls List of URLs to join
 */
export function mergeUrls(...urls: Array<string>) {
  return urls.reduce((finalUrl, currentUrl) => {
    const finalUrlParts = finalUrl ? finalUrl.split('/') : []
    const formattedCurrentUrl = currentUrl.replace(/^\//i, '')

    if (!finalUrl) {
      return currentUrl
    }

    if (
      finalUrl &&
      finalUrlParts.length &&
      formattedCurrentUrl.startsWith(finalUrlParts[finalUrlParts.length - 1])
    ) {
      return `${finalUrlParts.slice(0, finalUrlParts.length - 1).join('/')}/${formattedCurrentUrl}`
    }

    return `${finalUrlParts.join('/')}/${formattedCurrentUrl}`
  }, '')
}

export default mergeUrls
