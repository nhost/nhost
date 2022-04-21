import { Signature } from '../types'
import { getParametersFromParameterSignature } from './getParametersFromParameterSignature'

/**
 * Finds a parameter by identifier in original auto-generated JSON file and
 * extracts its nested parameters.
 *
 * @param referenceId - Reference identifier
 * @param originalDocument - Auto-generated JSON file
 * @returns Nested parameters of a referenced parameter
 */
export function findNestedParametersByReferenceId(
  referenceId: number | null,
  originalDocument: Array<Signature>
) {
  const originalParameter = originalDocument.find((originalSignature) => {
    return originalSignature.id === referenceId
  })

  if (originalParameter) {
    const nestedParameters = getParametersFromParameterSignature(originalParameter)

    return nestedParameters
  }

  return null
}

export default findNestedParametersByReferenceId
