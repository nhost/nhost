import { getLabelForType } from '../helpers'
import { Signature } from '../types'

/**
 * Creates a function signature documentation fragment.
 *
 * @example
 * ```ts
 * // Input
 * interface MyInterface {
 *   setItem: (a: string, b: string) => void;
 * }
 *
 * // Output for `setItem`
 * (a: string, b: string) => void
 * ```
 *
 * @param functionType - Function type for which to create the documentation
 * @returns Function signature documentation fragment
 */
export const FunctionSignatureTypeFragment = ({ parameters, type }: Signature) =>
  `(${
    parameters
      ?.map(
        (parameter) => `${parameter.name}: ${getLabelForType(parameter.type).replace(/\`/gi, '')}`
      )
      .join(', ') || ''
  }) => ${getLabelForType(type).replace(/\`/gi, '')}`

export default FunctionSignatureTypeFragment
