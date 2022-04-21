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
