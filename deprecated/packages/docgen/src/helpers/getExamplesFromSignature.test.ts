import { expect, test } from 'vitest'

import { mockSignature } from '../__mocks__/mockSignature'
import getExamplesFromSignature from './getExamplesFromSignature'

test(`should return an empty array if signature doesn't have comments or tags`, () => {
  expect(getExamplesFromSignature(mockSignature)).toEqual([])
  expect(getExamplesFromSignature({ ...mockSignature, comment: {} })).toEqual([])
  expect(getExamplesFromSignature({ ...mockSignature, comment: { tags: [] } })).toEqual([])
})

test(`should contain only the examples from the comment`, () => {
  expect(
    getExamplesFromSignature({
      ...mockSignature,
      comment: {
        tags: [
          { tag: 'example', text: 'test-example-1' },
          { tag: 'default', text: 'test-default-value' },
          { tag: 'example', text: 'test-example-2' },
          { tag: 'author', text: 'John Doe' }
        ]
      }
    })
  ).toEqual([
    { tag: '', text: 'test-example-1' },
    { tag: '', text: 'test-example-2' }
  ])
})
