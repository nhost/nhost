import { expect, test } from 'vitest'

import UnionOrIntersectionTypeFragment from './UnionOrIntersectionTypeFragment'

test(`should not return anything if list of types in the union is undefined`, () => {
  expect(UnionOrIntersectionTypeFragment({ type: 'union' })).toBe('')
  expect(UnionOrIntersectionTypeFragment({ type: 'union', types: [] })).toBe('')
})

test('should return a documentation fragment for a union type', () => {
  expect(
    UnionOrIntersectionTypeFragment({
      type: 'union',
      types: [
        { type: 'intrinsic', name: 'string' },
        { type: 'reference', name: 'SampleType' }
      ]
    })
  ).toBe(
    `\`\`\`ts
string | SampleType
\`\`\``
  )

  expect(
    UnionOrIntersectionTypeFragment(
      {
        type: 'union',
        types: [
          { type: 'intrinsic', name: 'string' },
          { type: 'reference', name: 'SampleType' }
        ]
      },
      { wrap: false }
    )
  ).toBe(`<code>string</code> | <code>SampleType</code>`)
})

test('should return a documentation fragment for an intersection type', () => {
  expect(
    UnionOrIntersectionTypeFragment({
      type: 'intersection',
      types: [
        { type: 'intrinsic', name: 'string' },
        { type: 'reference', name: 'SampleType' }
      ]
    })
  ).toBe(
    `\`\`\`ts
string & SampleType
\`\`\``
  )

  expect(
    UnionOrIntersectionTypeFragment(
      {
        type: 'intersection',
        types: [
          { type: 'intrinsic', name: 'string' },
          { type: 'reference', name: 'SampleType' }
        ]
      },
      { wrap: false }
    )
  ).toBe(`<code>string</code> & <code>SampleType</code>`)
})

test('should not have references to types when the content is wrapped in a code block', () => {
  expect(
    UnionOrIntersectionTypeFragment({
      type: 'union',
      types: [
        { type: 'intrinsic', name: 'string' },
        { type: 'reference', name: 'SampleType', id: 1 }
      ]
    })
  ).toBe(
    `\`\`\`ts
string | SampleType
\`\`\``
  )

  expect(
    UnionOrIntersectionTypeFragment({
      type: 'intersection',
      types: [
        { type: 'intrinsic', name: 'string' },
        { type: 'reference', name: 'SampleType', id: 1 }
      ]
    })
  ).toBe(
    `\`\`\`ts
string & SampleType
\`\`\``
  )
})

test('wrapped code block should have the original name of the type if it is provided', () => {
  expect(
    UnionOrIntersectionTypeFragment(
      {
        type: 'union',
        types: [
          { type: 'intrinsic', name: 'string' },
          { type: 'reference', name: 'SampleType', id: 1 }
        ]
      },
      { originalName: 'OriginalType' }
    )
  ).toBe(
    `\`\`\`ts
type OriginalType = string | SampleType
\`\`\``
  )
})
