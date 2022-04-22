import { format } from 'prettier'

import { CommentFragment, DeprecationNoteFragment, FunctionFragment } from '../fragments'
import { ClassSignature, Signature } from '../types'

/**
 * Creates a page template for a class.
 *
 * @param signature - Class signature
 * @param originalDocument - Auto-generated JSON file
 * @returns Prettified class page template
 */
export const ClassTemplate = (
  { name, comment, children }: ClassSignature,
  originalDocument?: Array<Signature>
) => {
  const deprecationTag = comment?.tags?.find(({ tag }) => tag === 'deprecated')

  return format(
    `
---
title: ${name}
description: ${comment?.shortText?.replace(/\n/gi, ' ') || 'No description provided.'}
---

# \`${name}\`

${comment ? CommentFragment(comment) : ''}

${deprecationTag ? DeprecationNoteFragment(deprecationTag, 'This class is deprecated.') : ``}

${
  children
    ? children
        .filter((child) => child.kindString === 'Constructor')
        .map((signature) =>
          signature.signatures
            ? signature.signatures
                .map((constructorSignature) =>
                  FunctionFragment(constructorSignature, originalDocument, {
                    numberOfTotalFunctions: signature.signatures!.length,
                    isConstructor: true
                  })
                )
                .join('\n\n')
            : ''
        )
        .join(`\n\n`)
    : ''
}`,
    { parser: 'markdown', semi: false, singleQuote: true }
  )
}

export default ClassTemplate
