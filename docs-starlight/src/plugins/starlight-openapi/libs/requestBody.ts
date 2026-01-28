import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

import type { Operation } from './operation'
import type { Parameter } from './parameter'
import type { Schema } from './schema'

export function getOpenAPIV2RequestBodyParameter(operation: Operation): OpenAPIV2.InBodyParameterObject | undefined {
  if ('requestBody' in operation || operation.parameters === undefined) {
    return
  }

  return (operation.parameters as Parameter[]).find(isOpenAPIV2RequestBodyParameter)
}

export function getOpenAPIV3RequestBody(operation: Operation): RequestBody | undefined {
  if (!isOperationWithRequestBody(operation)) {
    return
  }

  return operation.requestBody
}

export function hasRequestBody(operation: Operation): boolean {
  return getOpenAPIV2RequestBodyParameter(operation) !== undefined || getOpenAPIV3RequestBody(operation) !== undefined
}

export function getOpenAPIV2OperationConsumes(schema: Schema, operation: Operation): OpenAPIV2.MimeTypes | undefined {
  if ('consumes' in operation) {
    return operation.consumes
  } else if ('consumes' in schema.document) {
    return schema.document.consumes
  }

  return
}

export function getOpenAPIV2OperationProduces(schema: Schema, operation: Operation): OpenAPIV2.MimeTypes | undefined {
  if ('produces' in operation) {
    return operation.produces
  } else if ('produces' in schema.document) {
    return schema.document.produces
  }

  return
}

function isOpenAPIV2RequestBodyParameter(parameter: Parameter): parameter is OpenAPIV2.InBodyParameterObject {
  return parameter.in === 'body'
}

function isOperationWithRequestBody(operation: Operation): operation is Operation & { requestBody: RequestBody } {
  return 'requestBody' in operation && typeof operation.requestBody === 'object'
}

type RequestBody = OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject
