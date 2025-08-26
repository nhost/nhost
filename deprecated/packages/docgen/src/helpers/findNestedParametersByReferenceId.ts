import { Signature } from '../types'

/**
 * Returns the parameters from a parameter signature. Usually you want to use
 * this function if you want to get the parameters of a complex type (e.g: an
 * interface or a type alias).
 *
 * @param parameterSignature - Parameter signature
 * @returns Parameters of the parameter signature
 */
function getParametersFromParameterSignature(parameterSignature: Signature) {
  if (
    parameterSignature.kindString === 'Type alias' &&
    parameterSignature.type?.type === 'reflection'
  ) {
    const { declaration } = parameterSignature.type

    return declaration.children
  }

  if (parameterSignature.kindString === 'Interface' && parameterSignature.children) {
    return parameterSignature.children
  }

  return null
}

/**
 * Finds a parameter by identifier in original auto-generated JSON file and
 * extracts its nested parameters.
 *
 * @param referenceId - Reference identifier
 * @param originalDocument - Auto-generated JSON file
 * @returns Nested parameters of a referenced parameter
 */
export function findNestedParametersByReferenceId(
  referenceId: number,
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
