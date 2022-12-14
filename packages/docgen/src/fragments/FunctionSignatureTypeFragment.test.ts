import { expect, test } from 'vitest'

import FunctionSignatureTypeFragment from './FunctionSignatureTypeFragment'

test('should generate function signature with a list of arguments', () => {
  expect(
    FunctionSignatureTypeFragment({
      id: 713,
      name: 'setItem',
      kind: 4096,
      kindString: 'Call signature',
      flags: {},
      comment: {
        shortText: 'Set item.'
      },
      parameters: [
        {
          id: 714,
          name: '_key',
          kind: 32768,
          kindString: 'Parameter',
          flags: {},
          type: {
            type: 'intrinsic',
            name: 'string'
          }
        },
        {
          id: 715,
          name: '_value',
          kind: 32768,
          kindString: 'Parameter',
          flags: {},
          type: {
            type: 'intrinsic',
            name: 'string'
          }
        }
      ],
      type: {
        type: 'intrinsic',
        name: 'void'
      },
      signatures: [],
      sources: []
    })
  ).toBe(`\`\`\`ts
(_key: string, _value: string) => void
\`\`\``)
})

test('should generate function signature without a list of arguments', () => {
  expect(
    FunctionSignatureTypeFragment({
      id: 713,
      name: 'setItem',
      kind: 4096,
      kindString: 'Call signature',
      flags: {},
      comment: {
        shortText: 'Set item.'
      },
      type: {
        type: 'intrinsic',
        name: 'void'
      },
      signatures: [],
      sources: []
    })
  ).toBe(`\`\`\`ts
() => void
\`\`\``)
})

test('should not wrap the function signature if setting is turned off', () => {
  expect(
    FunctionSignatureTypeFragment(
      {
        id: 713,
        name: 'setItem',
        kind: 4096,
        kindString: 'Call signature',
        flags: {},
        comment: {
          shortText: 'Set item.'
        },
        type: {
          type: 'intrinsic',
          name: 'void'
        },
        signatures: [],
        sources: []
      },
      { wrap: 'none' }
    )
  ).toBe('() => void')
})

test('should wrap the function signature in a code block', () => {
  expect(
    FunctionSignatureTypeFragment(
      {
        id: 713,
        name: 'setItem',
        kind: 4096,
        kindString: 'Call signature',
        flags: {},
        comment: {
          shortText: 'Set item.'
        },
        type: {
          type: 'union',
          types: [
            { type: 'intrinsic', name: 'string' },
            { type: 'reference', name: 'Test' }
          ]
        },
        signatures: [],
        sources: []
      },
      { wrap: 'code-block' }
    )
  ).toBe('<code>() =&gt; string &#124; Test</code>')

  expect(
    FunctionSignatureTypeFragment(
      {
        id: 713,
        name: 'setItem',
        kind: 4096,
        kindString: 'Call signature',
        flags: {},
        comment: {
          shortText: 'Set item.'
        },
        type: {
          type: 'intrinsic',
          name: 'void'
        },
        signatures: [],
        sources: []
      },
      { wrap: 'code-block' }
    )
  ).toBe('<code>() =&gt; void</code>')

  expect(
    FunctionSignatureTypeFragment(
      {
        id: 713,
        name: 'setItem',
        kind: 4096,
        kindString: 'Call signature',
        flags: {},
        comment: {
          shortText: 'Set item.'
        },
        type: {
          type: 'reference',
          typeArguments: [
            {
              type: 'reference',
              typeArguments: [
                {
                  type: 'reference',
                  id: 1056,
                  name: 'StateErrorTypes'
                },
                {
                  type: 'reference',
                  id: 3122,
                  name: 'ErrorPayload'
                }
              ],
              qualifiedName: 'Record',
              package: '.pnpm',
              name: 'Record'
            }
          ],
          qualifiedName: 'Partial',
          name: 'Partial'
        },
        signatures: [],
        sources: []
      },
      { wrap: 'code-block' }
    )
  ).toBe('<code>() =&gt; Partial&lt;Record&lt;StateErrorTypes, ErrorPayload&gt;&gt;</code>')
})
