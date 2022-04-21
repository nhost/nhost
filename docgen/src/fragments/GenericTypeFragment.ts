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
      ? `\<${typeArguments
          .map((argument) => {
            if (argument.type === 'reference' || argument.type === 'intrinsic') {
              return argument.name
            }

            if (argument.type === 'query') {
              return argument.queryType.name
            }

            if (argument.type === 'array') {
              return `Array<${getLabelForType(argument.elementType, {
                reference: false
              })}>`
            }

            if (argument.type === 'reflection') {
              return argument.declaration.name
            }

            if (typeof argument.value === 'number') {
              return argument.value
            }

            if (argument.value === null) {
              return `null`
            }

            if (argument.value === undefined) {
              return `undefined`
            }

            return `\"${argument.value}\"`
          })
          .join(', ')}\>`
      : ``
  }`

export default GenericTypeFragment
