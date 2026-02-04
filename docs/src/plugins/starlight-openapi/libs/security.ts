import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

import type { Document } from './document'
import type { Operation } from './operation'
import type { Schema } from './schema'

export function getSecurityRequirements(operation: Operation, schema?: Schema): SecurityRequirement[] | undefined {
  if ('security' in operation) {
    return operation.security
  } else if (schema && 'security' in schema.document) {
    return schema.document.security
  }

  return
}

export function getSecurityDefinitions(document: Document): SecurityDefinitions | undefined {
  if ('securityDefinitions' in document) {
    return document.securityDefinitions
  } else if ('components' in document && 'securitySchemes' in document.components) {
    return document.components.securitySchemes as SecurityDefinitions
  }

  return
}

export function isOpenAPIV2OAuth2SecurityScheme(
  securityScheme: SecurityScheme,
): securityScheme is OpenAPIV2.SecuritySchemeOauth2 {
  return securityScheme.type === 'oauth2' && 'flow' in securityScheme
}

export function isOpenAPIV3OAuth2SecurityScheme(
  securityScheme: SecurityScheme,
): securityScheme is OpenAPIV3.OAuth2SecurityScheme | OpenAPIV3_1.OAuth2SecurityScheme {
  return securityScheme.type === 'oauth2' && 'flows' in securityScheme
}

type SecurityScheme = OpenAPIV2.SecuritySchemeObject | OpenAPIV3.SecuritySchemeObject | OpenAPIV3_1.SecuritySchemeObject
export type SecuritySchemeOAuth2Flow = NonNullable<
  | OpenAPIV2.SecuritySchemeOauth2
  | OpenAPIV3.OAuth2SecurityScheme['flows'][keyof OpenAPIV3.OAuth2SecurityScheme['flows']]
>
export type SecurityDefinitions = Record<string, SecurityScheme>
type SecurityRequirement =
  | OpenAPIV2.SecurityRequirementObject
  | OpenAPIV3.SecurityRequirementObject
  | OpenAPIV3_1.SecurityRequirementObject
