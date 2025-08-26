import { format } from 'prettier'
import { snapshot } from 'valtio'

import { FunctionFragment, FunctionFragmentOptions } from '../fragments'
import { appState } from '../state'
import { Signature } from '../types'

/**
 * Creates a page template for a function.
 *
 * @param signature - Function signature
 * @param originalDocument - Auto-generated JSON file
 * @param slug - Slug to use for generating documentation links
 * @param functionFragmentOptions - Options for the function fragment
 * @returns Prettified function page template
 */
export const FunctionTemplate = (
  { id, name, comment, signatures }: Signature,
  originalDocument?: Array<Signature>,
  functionFragmentOptions?: FunctionFragmentOptions
) => {
  const alias = comment?.tags?.find(({ tag }) => tag === 'alias')?.text.replace(/\n/g, '')
  const { contentReferences } = snapshot(appState)
  const isComponent = contentReferences.get(id) === 'Component'

  const header = `---
title: ${isComponent ? `<${name} />` : `${name}()`}
sidebarTitle: ${isComponent ? `<${alias || name} />` : `${alias || name}()`}
---`.replace(/\n\n/gi, '\n')

  return format(
    `${header}

${signatures && signatures.length > 1 ? `# \`${name}()\`` : ``}

${
  signatures
    ? signatures
        .map((signature, index) =>
          FunctionFragment(signature, originalDocument, {
            numberOfOverloads: signatures.length,
            index,
            ...functionFragmentOptions
          })
        )
        .join('\n\n')
    : ''
}
`,
    { parser: 'markdown', semi: false, singleQuote: true, trailingComma: 'none' }
  )
}

export default FunctionTemplate
