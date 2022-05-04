import { getLabelForType } from '../helpers'
import { ReferenceType } from '../types'

/**
 * Generates a type documentation fragment for a given generic type.
 *
 * @example
 * **Input:**
 * ```
 * Omit
 *   -> SampleType
 *   -> 'excludedAttribute'
 * ```
 *
 * **Output:**
 * ```ts
 * Omit<SampleType, 'excludedAttribute'>
 * ```
 *
 * @param type - Type reference
 * @returns Generic type documentation fragment
 */
export const GenericTypeFragment = ({ name, qualifiedName, typeArguments }: ReferenceType) =>
  `${qualifiedName || name}${
    typeArguments && typeArguments.length > 0
      ? `<${typeArguments
          .map((argument) => getLabelForType(argument, { reference: false, wrap: false }))
          .join(', ')}>`
      : ``
  }`

export default GenericTypeFragment
