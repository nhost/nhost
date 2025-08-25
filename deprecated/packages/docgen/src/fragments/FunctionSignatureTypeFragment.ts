import { getLabelForType, GetLabelForTypeOptions } from '../helpers'
import codifyValue from '../helpers/codifyValue'
import { Signature } from '../types'

export type FunctionSignatureTypeFragmentOptions = {
  /**
   * Determines whether or not to wrap the fragment in a markdown code block.
   *
   * @default true
   */
  wrap?: 'triple-backticks' | 'code-block' | 'none'
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
  { wrap = 'triple-backticks', originalName }: FunctionSignatureTypeFragmentOptions = {},
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

  if (wrap === 'none') {
    return content
  }

  if (wrap === 'code-block') {
    return codifyValue(content)
  }

  return `
\`\`\`ts
${originalName ? `type ${originalName} = ` : ``}${content.replace(/`/gi, '')}
\`\`\`
  `.trim()
}

export default FunctionSignatureTypeFragment
