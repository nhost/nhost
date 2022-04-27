import { Signature } from '../types'

/**
 * Returns the examples from the comment.
 *
 * @param signature - Signature to get examples from.
 * @returns Examples from the comment.
 */
export function getExamplesFromSignature(signature: Signature) {
  return signature.comment && signature.comment.tags && signature.comment.tags.length > 0
    ? signature.comment.tags
        .filter(({ tag }) => tag === 'example')
        .map(({ text }) => ({ tag: ``, text }))
    : []
}

export default getExamplesFromSignature
