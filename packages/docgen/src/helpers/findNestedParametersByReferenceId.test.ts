import { expect, test } from 'vitest'

import { Parameter, Signature } from '../types'
import findNestedParametersByReferenceId from './findNestedParametersByReferenceId'

const parameterList: Array<Parameter> = [
  {
    id: 1,
    name: 'id',
    kind: 0,
    kindString: 'Property',
    flags: {},
    type: {
      type: 'intrinsic',
      name: 'string'
    }
  },
  {
    id: 2,
    name: 'isAvailable',
    kind: 0,
    kindString: 'Property',
    flags: {},
    type: {
      type: 'intrinsic',
      name: 'boolean'
    }
  }
]

const originalDocument: Array<Signature> = [
  {
    id: 1,
    kind: 0,
    kindString: 'Interface',
    name: 'TestInterface1',
    flags: {},
    children: parameterList
  },
  {
    id: 2,
    kind: 0,
    kindString: 'Interface',
    name: 'TestInterface2',
    flags: {},
    children: []
  },
  {
    id: 3,
    kind: 0,
    kindString: 'Type alias',
    name: 'TestTypeAlias1',
    flags: {},
    type: {
      type: 'reflection',
      declaration: {
        id: 0,
        kind: 0,
        name: '__type',
        flags: {},
        kindString: 'Type literal',
        children: parameterList
      }
    }
  },
  {
    id: 4,
    kind: 0,
    kindString: 'Type alias',
    name: 'TestTypeAlias2',
    flags: {},
    type: {
      type: 'reflection',
      declaration: {
        id: 0,
        kind: 0,
        name: '__type',
        flags: {},
        kindString: 'Type literal',
        children: []
      }
    }
  },
  {
    id: 5,
    kind: 0,
    kindString: 'Type alias',
    name: 'TestTypeAlias3',
    flags: {},
    children: []
  },
  {
    id: 6,
    kind: 0,
    kindString: 'Class',
    name: 'TestClass1',
    flags: {},
    children: []
  }
]

test(`should return null if original document is empty or children can't be returned`, () => {
  expect(findNestedParametersByReferenceId(1, [])).toBeNull()
  expect(findNestedParametersByReferenceId(5, originalDocument)).toEqual(null)
  expect(findNestedParametersByReferenceId(6, originalDocument)).toEqual(null)
})

test('should find the nested parameters of a parameter by reference identifier in the signature list', () => {
  expect(findNestedParametersByReferenceId(1, originalDocument)).toEqual(parameterList)
  expect(findNestedParametersByReferenceId(2, originalDocument)).toEqual([])
  expect(findNestedParametersByReferenceId(3, originalDocument)).toEqual(parameterList)
  expect(findNestedParametersByReferenceId(4, originalDocument)).toEqual([])
})
