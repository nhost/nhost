export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function interspece<TSeparator, TElement>(
  separator: TSeparator,
  elements: TElement[],
): (TElement | TSeparator)[] {
  const result: (TElement | TSeparator)[] = []

  for (const [index, element] of elements.entries()) {
    if (index === elements.length - 1) {
      result.push(element)
    } else {
      result.push(element, separator)
    }
  }

  return result
}
