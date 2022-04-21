import { getLabelForType, GetLabelForTypeOptions } from '../helpers'
import { Parameter } from '../types'
import { CommentFragment } from './CommentFragment'
import FunctionSignatureTypeFragment from './FunctionSignatureTypeFragment'

/**
 * Creates a parameter documentation fragment.
 *
 * @param parameter - Parameter for which to create the documentation
 * @param labelOptions - Options to customize the label
 * @returns Parameter documentation fragment
 */
export const ParameterFragment = (
  { name, flags, type, comment, kindString, signatures }: Parameter,
  labelOptions?: GetLabelForTypeOptions
) => `
---

**${name || ``}** _${flags.isOptional ? 'optional' : 'required'}_ ${
  // function signatures behave slightly differently than other types
  kindString === 'Method' && signatures && signatures.length > 0
    ? `\`${FunctionSignatureTypeFragment(signatures[0])}\``
    : getLabelForType(type, labelOptions)
}

${comment ? CommentFragment(comment) : ''}
`

export default ParameterFragment
