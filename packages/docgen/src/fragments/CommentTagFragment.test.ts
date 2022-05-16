import { expect, test } from 'vitest'

import CommentTagFragment from './CommentTagFragment'

test('should create a fragment with a formatted tag name and the text', () => {
  expect(CommentTagFragment({ tag: 'author', text: 'John Doe' })).toBe(
    `**\`@author\`**

John Doe`
  )
})

test('should wrap the text in backticks if the tag is "default"', () => {
  expect(CommentTagFragment({ tag: 'default', text: "'value'" })).toBe(`**\`@default\`**

\`"value"\``)
})

test('should remove leading or trailing new lines from the text', () => {
  expect(CommentTagFragment({ tag: 'author', text: '\nJohn Doe\n' })).toBe(
    `**\`@author\`**

John Doe`
  )

  expect(CommentTagFragment({ tag: 'default', text: '\n"value"\n' })).toBe(
    `**\`@default\`**

\`"value"\``
  )
})
