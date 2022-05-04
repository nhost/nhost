import { removeLinksFromText } from '../helpers'
import { CommentTag } from '../types'

/**
 * Creates a deprecation note documentation fragment.
 *
 * @param tag - Deprecation tag
 * @param defaultMessage - Default message if no text is provided
 * @returns Deprecation note
 */
export const DeprecationNoteFragment = (
  tag: CommentTag,
  defaultMessage: string = 'No description provided.'
) => `:::caution Deprecated
${removeLinksFromText(tag.text.replace(/(^\n|\n$)/gi, ``)) || defaultMessage}
:::`

export default DeprecationNoteFragment
