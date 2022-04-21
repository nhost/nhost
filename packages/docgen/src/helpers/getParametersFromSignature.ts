import { Signature } from '../types'
import findNestedParametersByReferenceId from './findNestedParametersByReferenceId'

/**
 * Creates the parameter documentation fragment for a function from the
 * auto-generated JSON file.
 *
 * @param signature - Function signature
 * @param originalDocument - Auto-generated JSON file
 * @returns Parameters of the function and the referenced parameter if there is
 * any
 */
export function getParametersFromSignature(
  { parameters }: Signature,
  originalDocument?: Array<Signature>
) {
  return parameters && parameters.length > 0
    ? parameters.map((parameter) => {
        // note: we are also returning the parameters of a complex type here
        // (e.g: a custom interface or type alias)
        if (parameter.type.type === 'reference' && originalDocument) {
          if (!parameter.type.id) {
            return {
              parameter
            }
          }

          const nestedParameters = findNestedParametersByReferenceId(
            parameter.type.id,
            originalDocument
          )

          if (nestedParameters) {
            return {
              parameter,
              referencedParameter: {
                name: parameter.type.name,
                parameters: nestedParameters
              }
            }
          }
        }

        return {
          parameter
        }
      })
    : []
}

export default getParametersFromSignature
