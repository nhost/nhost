import { CommentTag } from '../types'

/**
 * Creates a comment tag documentation fragment.
 *
 * @param commentTag - Comment tag for which to create the documentation
 * @returns Comment tag documentation fragment
 */
export const CommentTagFragment = ({ tag, text }: CommentTag) =>
  ` 
${tag ? `**\`@${tag.replace(/(^\n|\n$)/gi, ``)}\`**\n` : ``}
${
  text
    ? tag && tag === 'default'
      ? `\`${text.replace(/(^\n|\n$)/gi, ``).replace(/'/gi, '"')}\`\n`
      : `${text.replace(/(^\n|\n$)/gi, ``)}\n`
    : ``
}
`

export default CommentTagFragment
