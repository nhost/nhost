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
  defaultMessage: string = '_No description provided._'
) => `
:::caution Deprecated
${tag.text.replace(/\n/gi, ``) || defaultMessage}
:::
`

export default DeprecationNoteFragment
