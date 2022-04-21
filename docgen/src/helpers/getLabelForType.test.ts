import getLabelForType from './getLabelForType'

test(`should render an empty string if type is undefined or its underlying type is`, () => {
  expect(getLabelForType()).toBe('')
})

test('should generate label for intrinsic types', () => {
  expect(getLabelForType({ type: 'intrinsic', name: 'boolean' })).toBe('`boolean`')

  expect(getLabelForType({ type: 'intrinsic', name: 'string' })).toBe('`string`')
})

test('should generate label for reference types', () => {
  expect(getLabelForType({ type: 'reference', name: 'Test' })).toBe('`Test`')

  expect(getLabelForType({ id: 1, type: 'reference', name: 'Test' })).toBe(
    '[`Test`](../types/test)'
  )

  expect(
    getLabelForType({
      type: 'reference',
      name: 'Test',
      typeArguments: [
        { type: 'intrinsic', name: 'string' },
        { type: 'intrinsic', name: 'number' }
      ]
    })
  ).toBe('`Test<string, number>`')
})

test('should generate label for reflection types', () => {
  expect(
    getLabelForType({
      type: 'reflection',
      declaration: {
        id: 0,
        name: 'Test',
        kind: 0,
        kindString: '',
        flags: {},
        children: []
      }
    })
  ).toBe('`Test`')
})

test('should generate label for literal types', () => {
  expect(getLabelForType({ type: 'literal', value: 'test' })).toBe('`"test"`')
  expect(getLabelForType({ type: 'literal', value: 0 })).toBe('`0`')
})

test('should generate label for query types', () => {
  expect(
    getLabelForType({
      type: 'query',
      queryType: { name: 'Test', type: 'reference' }
    })
  ).toBe('`Test`')

  expect(
    getLabelForType({
      type: 'query',
      queryType: { name: 'Test', type: 'reference', id: 1 }
    })
  ).toBe('[`Test`](../types/test)')
})

test('should generate label for union or intersection types', () => {
  expect(
    getLabelForType({
      type: 'union',
      types: [
        { type: 'intrinsic', name: 'string' },
        { type: 'reference', name: 'Test' }
      ]
    })
  ).toBe('`string` \\| `Test`')
})

test('should change type reference path if "typeReferencePath" option is provided', () => {
  expect(
    getLabelForType({ type: 'reference', name: 'Test', id: 1 }, { typeReferencePath: './types' })
  ).toBe(`[\`Test\`](./types/test)`)
})

test('should generate label for array types', () => {
  expect(
    getLabelForType({
      type: 'array',
      elementType: {
        type: 'intrinsic',
        name: 'string'
      }
    })
  ).toBe('`Array<string>`')
})

test('should create an object signature for reflections', () => {
  expect(
    getLabelForType({
      type: 'reflection',
      declaration: {
        id: 0,
        name: '__type',
        kindString: 'reference',
        kind: 0,
        flags: {},
        children: [
          {
            id: 1,
            name: 'firstAttribute',
            kindString: 'Parameter',
            kind: 0,
            flags: {},
            type: {
              type: 'intrinsic',
              name: 'string'
            }
          },
          {
            id: 2,
            name: 'secondAttribute',
            kindString: 'Parameter',
            kind: 0,
            flags: {},
            type: {
              type: 'intrinsic',
              name: 'number'
            }
          },
          {
            id: 3,
            name: 'thirdAttribute',
            kindString: 'Parameter',
            kind: 0,
            flags: {},
            type: {
              type: 'literal',
              value: null
            }
          }
        ]
      }
    })
  ).toBe('`{ firstAttribute: string, secondAttribute: number, thirdAttribute: null }`')
})

test('should return "null" or "undefined" for falsy literal values', () => {
  expect(getLabelForType({ type: 'literal', value: null })).toBe('`null`')
  expect(getLabelForType({ type: 'literal', value: undefined })).toBe('`undefined`')
})
