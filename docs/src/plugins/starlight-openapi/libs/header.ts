import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

import type { Response } from './response'

export function isResponseWithHeaders(response: Response): response is Response & { headers: Headers } {
  return 'headers' in response && typeof response.headers === 'object'
}

export type Header = OpenAPIV2.HeaderObject | OpenAPIV3.HeaderObject | OpenAPIV3_1.HeaderObject
export type Headers = Record<string, Header>
