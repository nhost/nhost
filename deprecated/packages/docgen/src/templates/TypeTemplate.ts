import { format } from 'prettier'

import {
  CommentFragment,
  DeprecationNoteFragment,
  FunctionSignatureTypeFragment,
  ParameterFragment,
  ParameterTableFragment,
  UnionOrIntersectionTypeFragment
} from '../fragments'
import { findNestedParametersByReferenceId } from '../helpers'
import { Parameter, Signature } from '../types'

/**
 * Creates a page template for a type alias or an interface.
 *
 * @param parameter - Type or interface signature
 * @param originalDocument - Auto-generated JSON file
 * @returns Prettified type alias or interface page template
 */
export const TypeTemplate = (parameter: Parameter, originalDocument?: Array<Signature>) => {
  const { name, comment } = parameter

  const alias = comment?.tags?.find(({ tag }) => tag === 'alias')?.text.replace(/\n/g, '')
  const deprecationTag = comment?.tags?.find(({ tag }) => tag === 'deprecated')

  let parameters: Parameter[] = []

  if (parameter.kindString === 'Interface') {
    parameters = parameter.children || []
  } else if (parameter.type?.type === 'reflection' && parameter.type.declaration.children) {
    parameters = parameter.type.declaration.children
  }

  const header = `---
title: ${name}
sidebarTitle: ${alias || name}
${
  comment && comment.shortText
    ? `description: ${comment.shortText.replace(/\n/gi, ' ') || 'No description provided.'}`
    : 'description: No description provided.'
}
---`.replace(/\n\n/gi, '\n')

  return format(
    `${header}

# \`${name}\`

${comment ? CommentFragment(comment) : ''}

${deprecationTag ? DeprecationNoteFragment(deprecationTag, 'This type is deprecated.') : ``}

${
  parameter.type?.type === 'union' || parameter.type?.type === 'intersection'
    ? UnionOrIntersectionTypeFragment(parameter.type, { originalName: name })
    : parameter.type?.type === 'reflection'
    ? FunctionSignatureTypeFragment(parameter, { originalName: name })
    : parameters?.length > 0
    ? `## Parameters\n${parameters
        .map((parameter) => {
          // we are also rendering table of contents for referred parameter
          if (parameter.type?.type === 'reference' && originalDocument) {
            if (!parameter.type.id) {
              return ParameterFragment(parameter)
            }

            const nested = findNestedParametersByReferenceId(parameter.type.id, originalDocument)

            return nested
              ? `${ParameterFragment(parameter)}\n${ParameterTableFragment(nested, parameter)}`
              : ParameterFragment(parameter)
          }

          return ParameterFragment(parameter)
        })
        .concat('---')
        .join('\n\n')}`
    : ``
}`,
    { parser: 'markdown', semi: false, singleQuote: true, trailingComma: 'none' }
  )
}

export default TypeTemplate
