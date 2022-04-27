import { CommentTag } from '../types'

/**
 * Creates a comment tag documentation fragment.
 *
 * @param commentTag - Comment tag for which to create the documentation
 * @returns Comment tag documentation fragment
 */
export const CommentTagFragment = ({ tag, text }: CommentTag) =>
  `${tag ? `**\`@${tag.replace(/(^\n|\n$)/gi, ``)}\`**` : ``}

${
  text
    ? tag && tag === 'default'
      ? `\`${text.replace(/(^\n|\n$)/gi, ``).replace(/'/gi, '"')}\``
      : `${text.replace(/(^\n|\n$)/gi, ``)}`
    : ``
}`

export default CommentTagFragment
