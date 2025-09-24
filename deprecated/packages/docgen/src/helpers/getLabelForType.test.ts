import { snapshot } from 'valtio/vanilla'
import { afterEach, expect, test } from 'vitest'
import { appState } from '../state'
import getLabelForType from './getLabelForType'

// TODO: this is an implementation detail, dependency should be handled in some other way
const initialState = snapshot(appState)

afterEach(() => {
  appState.verbose = initialState.verbose
  appState.docsRoot = initialState.docsRoot
  appState.baseSlug = initialState.baseSlug
  appState.contentReferences = initialState.contentReferences
})

test(`should render an empty string if type is undefined or its underlying type is`, () => {
  expect(getLabelForType()).toBe('')
})

test('should generate label for intrinsic types', () => {
  expect(getLabelForType({ type: 'intrinsic', name: 'boolean' })).toBe('<code>boolean</code>')

  expect(getLabelForType({ type: 'intrinsic', name: 'string' })).toBe('<code>string</code>')
})

test('should generate label for reference types', () => {
  appState.contentReferences = new Map([[1, 'Interface']])

  expect(getLabelForType({ type: 'reference', name: 'Test' })).toBe('<code>Test</code>')

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
  ).toBe('<code>Test&lt;string, number&gt;</code>')
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
  ).toBe('<code>Test</code>')
})

test('should generate label for literal types', () => {
  expect(getLabelForType({ type: 'literal', value: 'test' })).toBe('<code>"test"</code>')
  expect(getLabelForType({ type: 'literal', value: 0 })).toBe('<code>0</code>')
})

test('should generate label for query types', () => {
  appState.contentReferences = new Map([[1, 'Interface']])

  expect(
    getLabelForType({
      type: 'query',
      queryType: { name: 'Test', type: 'reference' }
    })
  ).toBe('<code>Test</code>')

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

test('should include only the base slug in the reference URL for classes', () => {
  appState.baseSlug = '/reference/package'
  appState.docsRoot = 'reference/docgen/types'
  appState.contentReferences = new Map([[1, 'Class']])

  expect(getLabelForType({ name: 'AppClient', type: 'reference', id: 1 })).toBe(
    '[`AppClient`](/reference/package/app-client)'
  )
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
  ).toBe('<code>string &#124; Test</code>')
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
  ).toBe('<code>Array&lt;string&gt;</code>')
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
  ).toBe('<code>&#123; firstAttribute: string, secondAttribute: number, thirdAttribute: null &#125;</code>')
})

test('should return "null" or "undefined" for falsy literal values', () => {
  expect(getLabelForType({ type: 'literal', value: null })).toBe('<code>null</code>')
  expect(getLabelForType({ type: 'literal', value: undefined })).toBe('<code>undefined</code>')
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
  ).toBe(`<code>(_key: string, _value: string) =&gt; void</code>`)
})

test('should not wrap return value if the wrap option is false', () => {
  expect(getLabelForType({ type: 'intrinsic', name: 'string' }, { wrap: false })).toBe('string')
  expect(getLabelForType({ type: 'literal', value: 'Test' }, { wrap: false })).toBe('"Test"')
  expect(
    getLabelForType(
      {
        type: 'union',
        types: [
          { type: 'intrinsic', name: 'string' },
          { type: 'reference', name: 'Test' }
        ]
      },
      { wrap: false }
    )
  ).toBe('string | Test')
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
  expect(
    getLabelForType({ type: 'query', queryType: { type: 'reference', name: 'Test', id: 1 } })
  ).toBe('[`Test`](/some/test/root/folder/test)')
})

test(`should return only the name of the type if type has an identifier but can't be found in the context`, () => {
  appState.contentReferences = new Map([
    [1, 'Class'],
    [2, 'Interface']
  ])

  expect(getLabelForType({ type: 'reference', name: 'Test', id: 3 })).toBe('<code>Test</code>')
  expect(getLabelForType({ type: 'reference', name: 'Test', id: 3 }, { wrap: false })).toBe('Test')

  expect(
    getLabelForType({ type: 'query', queryType: { type: 'reference', name: 'Test', id: 3 } })
  ).toBe('<code>Test</code>')
  expect(
    getLabelForType(
      { type: 'query', queryType: { type: 'reference', name: 'Test', id: 3 } },
      { wrap: false }
    )
  ).toBe('Test')
})
