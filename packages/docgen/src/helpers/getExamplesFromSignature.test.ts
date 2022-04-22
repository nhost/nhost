import { Signature } from '../types'
import getExamplesFromSignature from './getExamplesFromSignature'

const signatureBase: Signature = {
  id: 1,
  name: 'Test Signature',
  kind: 0,
  kindString: '',
  flags: {}
}

test(`should return an empty array if signature doesn't have comments or tags`, () => {
  expect(getExamplesFromSignature(signatureBase)).toEqual([])
  expect(getExamplesFromSignature({ ...signatureBase, comment: {} })).toEqual([])
  expect(getExamplesFromSignature({ ...signatureBase, comment: { tags: [] } })).toEqual([])
})

test(`should contain only the examples from the comment`, () => {
  expect(
    getExamplesFromSignature({
      ...signatureBase,
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
