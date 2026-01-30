import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'

import type { Response } from './response'

export function isExamples(examples: unknown): examples is ExamplesV3 {
  return typeof examples === 'object'
}

export function isOpenAPIV2ResponseWithExamples(response: Response): response is Response & { examples: ExamplesV2 } {
  return 'examples' in response && typeof response.examples === 'object'
}

export type ExampleV3 = OpenAPIV3.ExampleObject | OpenAPIV3_1.ExampleObject
export type ExamplesV2 = OpenAPIV2.ExampleObject
export type ExamplesV3 = Record<string, ExampleV3>
