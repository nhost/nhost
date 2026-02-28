import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

export type Content = Record<string, OpenAPIV3.MediaTypeObject | OpenAPIV3_1.MediaTypeObject>
