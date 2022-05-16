import { expect, test } from 'vitest'

import mockParameter from '../__mocks__/mockParameter'
import mockSignature from '../__mocks__/mockSignature'
import { Parameter, Signature } from '../types'
import getNestedParametersFromParameter from './getNestedParametersFromParameter'

const testParameters: Array<Parameter> = [
  {
    ...mockParameter,
    id: 4,
    name: 'Test 1',
    type: { name: 'boolean', type: 'intrinsic' }
  },
  {
    ...mockParameter,
    id: 5,
    name: 'Test 2',
    type: { name: 'Test Parameter 2', type: 'reference', id: 2 }
  },
  {
    ...mockParameter,
    id: 6,
    name: 'Test 3',
    type: { name: 'Test Parameter 3', type: 'reference', id: 3 }
  }
]

const testOriginalDocument: Array<Signature> = [
  {
    ...mockSignature,
    id: 1,
    name: 'TestOptions1',
    kindString: 'Interface',
    children: testParameters
  },
  {
    ...mockSignature,
    id: 2,
    name: 'TestOptions2',
    kindString: 'Interface',
    children: testParameters
  },
  {
    ...mockSignature,
    id: 3,
    name: 'TestOptions3',
    kindString: 'Interface',
    children: testParameters
  }
]

test('should return only the original parameter if it is not a reference', () => {
  const nonReferenceParameter: Parameter = {
    ...mockParameter,
    type: { type: 'intrinsic', name: 'string' }
  }

  expect(getNestedParametersFromParameter(nonReferenceParameter)).toEqual({
    parameter: nonReferenceParameter
  })
})

test('should return only the original parameter if the original document is undefined or is empty', () => {
  expect(getNestedParametersFromParameter(mockParameter, undefined)).toEqual({
    parameter: mockParameter
  })
  expect(getNestedParametersFromParameter(mockParameter, [])).toEqual({ parameter: mockParameter })
})

test('should return only the original parameter if it is a reference, but has no reference identifier', () => {
  const parameterWithoutReferenceId: Parameter = {
    ...mockParameter,
    type: { type: 'reference', name: 'TestOptions1' }
  }

  expect(
    getNestedParametersFromParameter(parameterWithoutReferenceId, testOriginalDocument)
  ).toEqual({ parameter: parameterWithoutReferenceId })
})

test('should return only the original parameter if it is a reference, but the reference identifier is not found in the original document', () => {
  const parameterWithNonExistentReferenceId: Parameter = {
    ...mockParameter,
    type: { type: 'reference', id: 150, name: 'TestOptions1' }
  }

  expect(
    getNestedParametersFromParameter(parameterWithNonExistentReferenceId, testOriginalDocument)
  ).toEqual({ parameter: parameterWithNonExistentReferenceId })
})

test('should return the original and the referenced parameter containing the nested parameters if the reference identifier is found in the original document', () => {
  const parameterWithExistingReferenceId: Parameter = {
    ...mockParameter,
    type: { type: 'reference', id: 1, name: 'TestOptions1' }
  }

  expect(
    getNestedParametersFromParameter(parameterWithExistingReferenceId, testOriginalDocument)
  ).toEqual({
    parameter: parameterWithExistingReferenceId,
    referencedParameter: {
      name: 'TestOptions1',
      parameters: testParameters
    }
  })
})
