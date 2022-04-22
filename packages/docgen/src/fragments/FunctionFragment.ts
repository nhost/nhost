import { getExamplesFromSignature, getNestedParametersFromParameter } from '../helpers'
import { Signature } from '../types'
import CommentFragment from './CommentFragment'
import CommentTagFragment from './CommentTagFragment'
import DeprecationNoteFragment from './DeprecationNoteFragment'
import ParameterFragment from './ParameterFragment'
import ParameterTableFragment from './ParameterTableFragment'

export type FunctionFragmentOptions = {
  /**
   * Number of total functions in the same context. e.g: Number of functions in
   * the same file.
   *
   * @default 1
   */
  numberOfTotalFunctions?: number
  /**
   * Determines if the function fragment should be made for a constructor.
   *
   * @default false
   */
  isConstructor?: boolean
}

/**
 * Creates a function documentation fragment.
 *
 * @param signature - Function signature
 * @param originalDocument - Auto-generated JSON file
 * @param options - Options for the function fragment
 * @returns Function documentation fragment
 */
export const FunctionFragment = (
  signature: Signature,
  originalDocument?: Array<Signature>,
  { numberOfTotalFunctions = 1, isConstructor = false }: FunctionFragmentOptions = {}
) => {
  const examples = getExamplesFromSignature(signature)
  const parameters = signature.parameters
    ? signature.parameters.map((parameter) =>
        getNestedParametersFromParameter(parameter, originalDocument)
      )
    : []
  const deprecationTag = signature.comment?.tags?.find(({ tag }) => tag === 'deprecated')

  const firstExample = examples.length
    ? {
        tag: examples[0].tag,
        text: examples[0].text.match(/```[\s\S]+```\n$/gi)?.at(0) || ``
      }
    : undefined

  return `
${numberOfTotalFunctions === 1 && !isConstructor ? `# \`${signature.name}()\`` : ``}

${numberOfTotalFunctions > 1 && isConstructor && !signature.comment ? `## Constructor` : ``}

${
  signature.comment
    ? CommentFragment(signature.comment, {
        highlightTitle: numberOfTotalFunctions > 1
      })
    : ''
}

${
  deprecationTag
    ? DeprecationNoteFragment(
        deprecationTag,
        isConstructor ? 'This constructor is deprecated.' : 'This function is deprecated.'
      )
    : ``
}

${firstExample ? CommentTagFragment(firstExample) : ``}

${
  parameters.length > 0
    ? `${numberOfTotalFunctions > 1 ? `### Parameters` : `## Parameters`}\n${parameters
        .map(({ parameter, referencedParameter }) => {
          if (parameter && referencedParameter) {
            return `${ParameterFragment(parameter)}\n${ParameterTableFragment(
              referencedParameter.parameters,
              parameter
            )}`
          }

          return ParameterFragment(parameter)
        })
        .concat('---')
        .join('\n\n')}`
    : ``
}

${
  signature.comment &&
  signature.comment.tags &&
  signature.comment.tags.some(({ tag }) => tag === 'remarks')
    ? `## Notes\n${signature.comment.tags.find(({ tag }) => tag === 'remarks')?.text}`
    : ``
}

${
  examples.length > 1 || (!firstExample && examples.length > 0)
    ? `${isConstructor ? '### Examples' : '## Examples'}\n\n${examples
        .map(CommentTagFragment)
        .join('\n\n')}`
    : ``
}`
}

export default FunctionFragment
