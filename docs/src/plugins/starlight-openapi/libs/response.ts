import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

import type { Content } from './content'
import { isSchemaObject, type SchemaObject } from './schemaObject'

export function includesDefaultResponse(responses: Responses): responses is Responses & { default: Response } {
  return 'default' in responses && typeof responses.default === 'object'
}

export function getOpenAPIV2ResponseSchema(response: Response): SchemaObject | undefined {
  return 'schema' in response && isSchemaObject(response.schema) ? response.schema : undefined
}

export function getOpenAPIV3ResponseContent(response: Response): Content | undefined {
  return 'content' in response ? response.content : undefined
}

export type Response = OpenAPIV2.ResponseObject | OpenAPIV3.ResponseObject | OpenAPIV3_1.ResponseObject
export type Responses = OpenAPIV2.ResponsesObject | OpenAPIV3.ResponsesObject | OpenAPIV3_1.ResponsesObject
