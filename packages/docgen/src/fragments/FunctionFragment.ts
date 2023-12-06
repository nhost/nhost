import {
  getExamplesFromSignature,
  getNestedParametersFromParameter,
  removeLinksFromText
} from '../helpers'
import { Signature } from '../types'
import CommentFragment from './CommentFragment'
import CommentTagFragment from './CommentTagFragment'
import ParameterFragment from './ParameterFragment'
import ParameterTableFragment from './ParameterTableFragment'

export type FunctionFragmentOptions = {
  /**
   * Number of function overloads in the same context.
   *
   * @default 1
   */
  numberOfOverloads?: number
  /**
   * Determines if the function fragment should be made for a constructor.
   *
   * @default false
   */
  isConstructor?: boolean
  /**
   * Index of signature in signature list.
   */
  index?: number
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
  { numberOfOverloads = 1, isConstructor = false, index }: FunctionFragmentOptions = {}
) => {
  const examples = getExamplesFromSignature(signature)
  const parameters = signature.parameters
    ? signature.parameters.map((parameter) =>
        getNestedParametersFromParameter(parameter, originalDocument)
      )
    : []

  const firstExample = examples.length
    ? {
        tag: examples[0].tag,
        text: examples[0].text.match(/```[\s\S]+```\n$/gi)?.at(0) || ``
      }
    : undefined

  return `

${
  numberOfOverloads > 1 && index !== undefined
    ? isConstructor
      ? `## Constructor ${index + 1} of ${numberOfOverloads}`
      : `## Overload ${index + 1} of ${numberOfOverloads}`
    : ``
}

${signature.comment ? CommentFragment(signature.comment) : ''}

${firstExample ? CommentTagFragment(firstExample) : ``}

${
  parameters.length > 0
    ? `${numberOfOverloads > 1 ? `### Parameters` : `## Parameters`}\n${parameters
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
    : numberOfOverloads > 1
    ? `### Parameters
---

<span className="light-grey">This overload doesn't accept any arguments.</span>

---`
    : ``
}

${
  signature.comment &&
  signature.comment.tags &&
  signature.comment.tags.some(({ tag }) => tag === 'remarks')
    ? `${isConstructor || numberOfOverloads > 1 ? '### Notes' : '## Notes'}\n${removeLinksFromText(
        signature.comment.tags.find(({ tag }) => tag === 'remarks')?.text
      )}`
    : ``
}

${
  examples.length > 1 || (!firstExample && examples.length > 0)
    ? `${isConstructor || numberOfOverloads > 1 ? '### Examples' : '## Examples'}\n\n${examples
        .map(CommentTagFragment)
        .join('\n\n')}`
    : ``
}`
}

export default FunctionFragment
