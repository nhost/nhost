import { getLabelForType, GetLabelForTypeOptions } from '../helpers'
import { Parameter } from '../types'
import CommentFragment from './CommentFragment'
import DeprecationNoteFragment from './DeprecationNoteFragment'
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
) => {
  const deprecationTag = comment?.tags?.find(({ tag }) => tag === 'deprecated')

  return `
---

**<span className="parameter-name${deprecationTag ? ' deprecated' : ''}">${
    name || ``
  }</span>** <span className="optional-status">${
    flags.isOptional ? 'optional' : 'required'
  }</span> ${
    // function signatures behave slightly differently than other types
    kindString === 'Method' && signatures && signatures.length > 0
      ? FunctionSignatureTypeFragment(signatures[0], { wrap: 'code-block' })
      : getLabelForType(type, labelOptions)
  }

${comment ? CommentFragment(comment) : ''}

${deprecationTag ? DeprecationNoteFragment(deprecationTag, 'This parameter is deprecated.') : ``}
`
}

export default ParameterFragment
