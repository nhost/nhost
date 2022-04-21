import { GetLabelForTypeOptions, getLabelForType } from '../helpers'
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
 * @param labelOptions - Options to customize the label
 * @returns Function signature documentation fragment
 */
export const FunctionSignatureTypeFragment = (
  { parameters, type }: Signature,
  labelOptions?: GetLabelForTypeOptions
) =>
  `(${
    parameters
      ?.map(
        (parameter) =>
          `${parameter.name}: ${getLabelForType(parameter.type, { ...labelOptions, wrap: false })}`
      )
      .join(', ') || ''
  }) => ${getLabelForType(type, { wrap: false })}`

export default FunctionSignatureTypeFragment
