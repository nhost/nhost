import { Group } from '../types'

/**
 * Used to convert plural names coming from TypeDoc to singular names.
 */
const pluralSingularDictionary = new Map([
  ['Classes', 'Class'],
  ['Properties', 'Property'],
  ['Methods', 'Method'],
  ['Functions', 'Function'],
  ['Type aliases', 'Type alias'],
  ['Interfaces', 'Interface'],
  ['Modules', 'Module'],
  ['Methods', 'Method'],
  ['Variables', 'Variable'],
  ['Accessors', 'Accessor'],
  ['Constructors', 'Constructor']
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
  return groups.reduce((contentMap, { title, children }) => {
    const singularTitle = pluralSingularDictionary.get(title)

    children.forEach((child) => {
      contentMap.set(child, singularTitle || 'undefined')
    })

    return contentMap
  }, originalMap)
}

export default getModuleContentMap
