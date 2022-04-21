import { Comment } from '../types'
import { CommentTagFragment } from './CommentTagFragment'

export type CommentFragmentOptions = {
  /**
   * Determines whether or not to highlight the short text.
   */
  highlightTitle?: boolean
}

/**
 * Creates a comment documentation fragment.
 *
 * @param comment - Comment for which to create the documentation
 * @param options - Comment fragment options
 * @returns Comment documentation fragment
 */
export const CommentFragment = (
  { shortText, returns = '', tags }: Comment,
  { highlightTitle = false }: CommentFragmentOptions = {}
) =>
  `${highlightTitle ? (shortText ? `## ${shortText}` : '') : shortText || ``}

${
  tags
    ? tags
        // note: we are displaying remarks and examples in a separate section
        .filter(({ tag }) => tag !== 'remarks' && tag !== 'example' && tag !== 'deprecated')
        .concat(Boolean(returns) ? { tag: 'returns', text: returns } : { tag: ``, text: `` })
        .map(CommentTagFragment)
        .join('\n\n')
    : returns
    ? CommentTagFragment({ tag: 'returns', text: returns })
    : ``
}`

export default CommentFragment
