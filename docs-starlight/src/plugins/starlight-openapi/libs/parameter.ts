import type { OpenAPI, OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

import type { Header } from './header'

const ignoredHeaderParameters = new Set(['accept', 'authorization', 'content-type'])

export function getParametersByLocation(
  operationParameters: OpenAPI.Parameters | undefined,
  pathItemParameters: OpenAPI.Parameters | undefined,
) {
  const parametersByLocation = new Map<string, Parameters>()

  for (const parameter of [...(pathItemParameters ?? []), ...(operationParameters ?? [])]) {
    if (!isParameter(parameter) || isIgnoredParameter(parameter)) {
      continue
    }

    const id = getParameterId(parameter)
    const parametersById: Parameters = parametersByLocation.get(parameter.in) ?? new Map<ParameterId, Parameter>()

    parametersById.set(id, parameter)

    parametersByLocation.set(parameter.in, parametersById)
  }

  return new Map(
    [...parametersByLocation].sort((locationA, locationB) =>
      locationA[0] === 'path' ? -1 : locationB[0] === 'path' ? 1 : 0,
    ),
  )
}

export function isHeaderParameter(parameter: Header): parameter is Omit<Parameter, 'type'> {
  return typeof parameter === 'object' && !('name' in parameter) && !('in' in parameter)
}

function getParameterId(parameter: Parameter): ParameterId {
  return `${parameter.name}:${parameter.in}`
}

function isParameter(parameter: OpenAPI.Parameter): parameter is Parameter {
  return typeof parameter === 'object' && !('$ref' in parameter)
}

function isIgnoredParameter(parameter: Parameter): boolean {
  return (
    parameter.in === 'body' || (parameter.in === 'header' && ignoredHeaderParameters.has(parameter.name.toLowerCase()))
  )
}

export type Parameter = OpenAPIV2.Parameter | OpenAPIV3.ParameterObject | OpenAPIV3_1.ParameterObject
type ParameterId = `${Parameter['name']}:${Parameter['in']}`
type Parameters = Map<ParameterId, Parameter>
