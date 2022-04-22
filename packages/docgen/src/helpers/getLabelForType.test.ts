import { snapshot } from 'valtio/vanilla'

import { appState } from '../state'
import getLabelForType from './getLabelForType'

// TODO: this is an implementation detail, dependency should be handled in some other way
const initialState = snapshot(appState)

afterEach(() => {
  appState.verbose = initialState.verbose
  appState.docsRoot = initialState.docsRoot
  appState.contentReferences = initialState.contentReferences
})

test(`should render an empty string if type is undefined or its underlying type is`, () => {
  expect(getLabelForType()).toBe('')
})

test('should generate label for intrinsic types', () => {
  expect(getLabelForType({ type: 'intrinsic', name: 'boolean' })).toBe('`boolean`')

  expect(getLabelForType({ type: 'intrinsic', name: 'string' })).toBe('`string`')
})

test('should generate label for reference types', () => {
  expect(getLabelForType({ type: 'reference', name: 'Test' })).toBe('`Test`')

  expect(getLabelForType({ id: 1, type: 'reference', name: 'Test' }, { wrap: false })).toBe(
    '[`Test`](/types/test)'
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
    getLabelForType(
      {
        type: 'query',
        queryType: { name: 'Test', type: 'reference', id: 1 }
      },
      { wrap: false }
    )
  ).toBe('[`Test`](/types/test)')
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
  ).toBe('`string` | `Test`')
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

test('should generate label for function signatures', () => {
  expect(
    getLabelForType({
      type: 'reflection',
      declaration: {
        kind: 0,
        id: 0,
        name: '__type',
        kindString: 'Call signature',
        flags: {},
        signatures: [
          {
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
          }
        ]
      }
    })
  ).toBe(`\`(_key: string, _value: string) => void\``)
})

test('should not wrap return value in backticks if wrap option is false', () => {
  expect(getLabelForType({ type: 'intrinsic', name: 'string' }, { wrap: false })).toBe('string')
  expect(getLabelForType({ type: 'literal', value: 'Test' }, { wrap: false })).toBe('"Test"')
})

test('should return references to the root folder when type is a class', () => {
  appState.contentReferences = new Map([[1, 'Class']])

  expect(getLabelForType({ type: 'reference', name: 'Test', id: 1 })).toBe('[`Test`](/test)')
  expect(
    getLabelForType({ type: 'query', queryType: { type: 'reference', name: 'Test', id: 1 } })
  ).toBe('[`Test`](/test)')

  appState.docsRoot = 'some/test/root/folder'

  expect(getLabelForType({ type: 'reference', name: 'Test', id: 1 })).toBe(
    '[`Test`](/some/test/root/folder/test)'
  )
})
