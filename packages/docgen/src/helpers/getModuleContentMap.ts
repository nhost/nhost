import { Group } from '../types'

/**
 * Used to convert plural names coming from TypeDoc to singular names.
 */
const pluralSingularDictionary = new Map([
  ['classes', 'Class'],
  ['properties', 'Property'],
  ['methods', 'Method'],
  ['functions', 'Function'],
  ['type aliases', 'Type alias'],
  ['interfaces', 'Interface'],
  ['modules', 'Module'],
  ['methods', 'Method'],
  ['variables', 'Variable'],
  ['accessors', 'Accessor'],
  ['constructors', 'Constructor'],
  ['components', 'Component'],
  ['references', 'Reference']
])

/**
 * Converts a group of TypeDoc elements to a map of content types.
 *
 * @param groups - Groups of TypeDoc elements
 * @param originalMap - Original map to extend
 * @returns Map of content types
 */
export function getModuleContentMap(
  groups: Array<Group>,
  originalMap: Map<number, string> = new Map()
): Map<number, string> {
  return groups.reduce((contentMap, { title, children, categories }) => {
    const singularTitle = pluralSingularDictionary.get(title.toLowerCase())

    children.forEach((child) => {
      contentMap.set(child, singularTitle || 'undefined')
    })

    if (categories) {
      categories.forEach(({ title: categoryTitle, children: categoryChildren }) => {
        if (categoryTitle === 'Other') {
          return
        }

        const singularTitle = pluralSingularDictionary.get(categoryTitle.toLowerCase())

        categoryChildren.forEach((categoryChild) => {
          contentMap.set(categoryChild, singularTitle || 'undefined')
        })
      })
    }

    return contentMap
  }, originalMap)
}

export default getModuleContentMap
