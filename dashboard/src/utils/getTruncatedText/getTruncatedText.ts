/**
 * Returns truncated text.
 * @param text - The text to be truncated.
 * @param maxLength - The maximum length of the text to be returned minus the ellipsis.
 * @param mode - The mode of truncation. Can be 'start' or 'end'.
 * @param ellipsisLabel - The label to be used as ellipsis.
 * @returns
 */
export default function getTruncatedText(
  text: string,
  maxLength: number = 15,
  mode: 'start' | 'end' = 'end',
  ellipsisLabel: string = '...',
) {
  if (text.length <= maxLength) {
    return text;
  }

  if (mode === 'start') {
    return `${ellipsisLabel}${text.slice(text.length - maxLength).trim()}`;
  }

  return `${text.slice(0, maxLength).trim()}${ellipsisLabel}`;
}
