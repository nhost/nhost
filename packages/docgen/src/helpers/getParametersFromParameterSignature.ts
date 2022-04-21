import { Signature } from '../types'

/**
 * Returns the parameters from a parameter signature. Usually you want to use
 * this function if you want to get the parameters of a complex type (e.g: an
 * interface or a type alias).
 *
 * @param parameterSignature - Parameter signature
 * @returns Parameters of the parameter signature
 */
export function getParametersFromParameterSignature(parameterSignature: Signature) {
  if (
    parameterSignature?.kindString === 'Type alias' &&
    parameterSignature.type?.type === 'reflection'
  ) {
    const { declaration } = parameterSignature.type

    return declaration.children
  }

  if (parameterSignature?.kindString === 'Interface' && parameterSignature.children) {
    return parameterSignature.children
  }

  return null
}

export default getParametersFromParameterSignature
