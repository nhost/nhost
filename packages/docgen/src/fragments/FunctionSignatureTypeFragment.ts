import { GetLabelForTypeOptions, getLabelForType } from '../helpers'
import { Signature } from '../types'

export type FunctionSignatureTypeFragmentOptions = {
  /**
   * Determines whether or not to wrap the fragment in a markdown code block.
   *
   * @default true
   */
  wrap?: boolean
  /**
   * Original name of the type. This is going to be prepended to the code block
   * if wrap is `true`.
   *
   * @default undefined
   */
  originalName?: string
}

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
  { wrap = true, originalName }: FunctionSignatureTypeFragmentOptions = {},
  labelOptions?: GetLabelForTypeOptions
) => {
  const content = `(${
    parameters
      ? parameters
          .map(
            (parameter) =>
              `${parameter.name}: ${getLabelForType(parameter.type, {
                ...labelOptions,
                wrap: false
              })}`
          )
          .join(', ')
      : ''
  }) => ${getLabelForType(type, { wrap: false })}`

  if (wrap) {
    return `
\`\`\`ts
${originalName ? `type ${originalName} = ` : ``}${content.replace(/`/gi, '')}
\`\`\`
`.trim()
  }

  return content
}

export default FunctionSignatureTypeFragment
