export function createKebabCase(text: string) {
  let kebabText = ''

  if (text && text.toLowerCase) {
    kebabText = text
      .toLowerCase()
      .split(':')
      .join('')
      .split(';')
      .join('')
      .split('.')
      .join('-')
      .split('(')
      .join('')
      .split(')')
      .join('')
      .split(' ')
      .join('-')
  }

  return kebabText
}

export default createKebabCase
