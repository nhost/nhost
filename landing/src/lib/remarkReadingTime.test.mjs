import { describe, expect, it } from 'vitest'
import remarkReadingTime, {
  countWords,
  readingMinutes,
} from './remarkReadingTime.mjs'

function words(count) {
  return Array.from({ length: count }, () => 'word').join(' ')
}

/** An `export const article = { title: 'Post' }` node, as MDX parses it. */
function articleExport() {
  return {
    type: 'mdxjsEsm',
    data: {
      estree: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            declaration: {
              type: 'VariableDeclaration',
              kind: 'const',
              declarations: [
                {
                  type: 'VariableDeclarator',
                  id: { type: 'Identifier', name: 'article' },
                  init: {
                    type: 'ObjectExpression',
                    properties: [
                      {
                        type: 'Property',
                        key: { type: 'Identifier', name: 'title' },
                        value: { type: 'Literal', value: 'Post' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  }
}

function readingMinutesOf(tree) {
  const article = tree.children[0].data.estree.body[0].declaration
    .declarations[0].init

  return article.properties.find(
    (property) => property.key.name === 'readingMinutes',
  )?.value.value
}

describe('countWords', () => {
  it('splits on any whitespace and ignores the edges', () => {
    expect(countWords('  one two\n\tthree  ')).toBe(3)
    expect(countWords('')).toBe(0)
  })
})

describe('readingMinutes', () => {
  it('rounds up at 230 words a minute', () => {
    expect(readingMinutes(230)).toBe(1)
    expect(readingMinutes(231)).toBe(2)
  })

  it('never reports less than a minute', () => {
    expect(readingMinutes(0)).toBe(1)
  })
})

describe('remarkReadingTime', () => {
  it('adds readingMinutes to the article export, counting prose and code', () => {
    const tree = {
      type: 'root',
      children: [
        articleExport(),
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: words(300) },
            { type: 'inlineCode', value: words(100) },
          ],
        },
        { type: 'code', value: words(100) },
      ],
    }

    remarkReadingTime()(tree)

    expect(readingMinutesOf(tree)).toBe(3)
  })

  it('leaves MDX without an article export alone', () => {
    const tree = {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Hi' }] }],
    }

    remarkReadingTime()(tree)

    expect(tree.children).toHaveLength(1)
  })
})
