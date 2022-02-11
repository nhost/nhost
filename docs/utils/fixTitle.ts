export const fixTitle = (elem) => {
  switch (elem.category.split('-').join(' ')) {
    case 'graphql':
      return 'GraphQL'
    case 'sdk':
      return 'SDK'
    case 'cli':
      return 'CLI'
    default:
      return elem.category.split('-').join(' ')
  }
}
