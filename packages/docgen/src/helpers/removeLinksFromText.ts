/**
 * Replaces links in a text with the text of the link.
 *
 * @param text - Text to remove links from
 * @returns Text without links
 */
export function removeLinksFromText(text?: string) {
  if (!text) {
    return ''
  }

  return text.replace(/\{@link ?(\w+|\S+)\}/g, '$1')
}

export default removeLinksFromText
