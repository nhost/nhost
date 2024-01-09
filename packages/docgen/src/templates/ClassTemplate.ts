import { format } from 'prettier'

import { CommentFragment, DeprecationNoteFragment, FunctionFragment } from '../fragments'
import { removeLinksFromText } from '../helpers'
import { ClassSignature, Signature } from '../types'

/**
 * Creates a page template for a class.
 *
 * @param signature - Class signature
 * @param originalDocument - Auto-generated JSON file
 * @param slug - Slug to use for generating documentation links
 * @returns Prettified class page template
 */
export const ClassTemplate = (
  { name, comment, children }: ClassSignature,
  originalDocument?: Array<Signature>
) => {
  const deprecationTag = comment?.tags?.find(({ tag }) => tag === 'deprecated')

  const header = `---
title: ${name}
description: ${
    removeLinksFromText(comment?.shortText?.replace(/\n/gi, ' ')) || 'No description provided.'
  }
---`.replace(/\n\n/gi, '\n')

  return format(
    `${header}

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
                .map((constructorSignature, index) =>
                  FunctionFragment(constructorSignature, originalDocument, {
                    numberOfOverloads: signature.signatures!.length,
                    isConstructor: true,
                    index
                  })
                )
                .join('\n\n')
            : ''
        )
        .join(`\n\n`)
    : ''
}`,
    { parser: 'mdx', semi: false, singleQuote: true, trailingComma: 'none' }
  )
}

export default ClassTemplate
