/**
 * Returns the codified version for a given `value` if `wrap` is `true`.
 *
 * @param value - Value to wrap
 * @param wrap - Whether or not to wrap the fragment in a code block. This might be useful when the text is already wrapped in a code block.
 * @returns Wrapped value
 */
function codifyValue(value: string | number, wrap: boolean = true) {
  if (!wrap) {
    return value.toString()
  }

  if (typeof value === 'number') {
    return `<code>${value}</code>`
  }

  return `<code>${value
    .replace(/&/gi, '&amp;')
    .replace(/</gi, '&lt;')
    .replace(/>/gi, '&gt;')
    .replace(/{/gi, '&#123;')
    .replace(/}/gi, '&#125;')
    .replace(/\|/gi, '&#124;')}</code>`
}

export default codifyValue
