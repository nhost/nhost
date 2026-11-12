/**
 * Remark plugin that adds `readingMinutes` to a post's `export const article`.
 *
 * Putting it on `article` means the post page and the blog listing (which
 * imports `article` from every post) read the same number, without each post
 * having to pass it along.
 *
 * Plain JavaScript because `next.config.mjs` loads it directly.
 */

const WORDS_PER_MINUTE = 230

/** Node types whose `value` is text a reader reads, code included. */
const TEXT_NODES = new Set(['text', 'inlineCode', 'code'])

/** @param {string} text */
export function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length
}

/** @param {number} words */
export function readingMinutes(words) {
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

/** Words in every text node under `node`. */
function countTreeWords(node) {
  let words = TEXT_NODES.has(node.type) ? countWords(node.value ?? '') : 0

  for (const child of node.children ?? []) {
    words += countTreeWords(child)
  }

  return words
}

/** The object literal of `export const article = { ... }`, if this is it. */
function findArticleObject(program) {
  for (const statement of program?.body ?? []) {
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.declaration?.type !== 'VariableDeclaration'
    ) {
      continue
    }

    for (const declarator of statement.declaration.declarations) {
      if (
        declarator.id.name === 'article' &&
        declarator.init?.type === 'ObjectExpression'
      ) {
        return declarator.init
      }
    }
  }

  return null
}

export default function remarkReadingTime() {
  return (tree) => {
    const articleObject = tree.children
      .filter((node) => node.type === 'mdxjsEsm')
      .map((node) => findArticleObject(node.data?.estree))
      .find(Boolean)

    // Only blog posts export `article`; other MDX pages are left alone.
    if (!articleObject) {
      return
    }

    const minutes = readingMinutes(countTreeWords(tree))

    articleObject.properties.push({
      type: 'Property',
      kind: 'init',
      method: false,
      shorthand: false,
      computed: false,
      key: { type: 'Identifier', name: 'readingMinutes' },
      value: { type: 'Literal', value: minutes, raw: String(minutes) },
    })
  }
}
