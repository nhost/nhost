import type { OpenAPIV2 } from 'openapi-types'

import type { SchemaObject } from './schemaObject'

export function isOpenAPIV2Items(items: unknown): items is Items {
  return (
    items !== undefined && typeof items === 'object' && 'type' in (items as Items) && !('schema' in (items as Items))
  )
}

export function getType(items: Items): string | undefined {
  if (items.type === 'array' && items.items) {
    const arrayType = getType(items.items)

    return arrayType ? `Array<${arrayType}>` : 'Array'
  }

  return Array.isArray(items.type) ? items.type.join(' | ') : items.type
}

export function getBound(items: Items, type: 'maximum' | 'minimum'): string | undefined {
  const exclusive = items[type === 'maximum' ? 'exclusiveMaximum' : 'exclusiveMinimum']
  const sign = type === 'maximum' ? '<' : '>'
  const value = items[type]

  if (typeof exclusive === 'number') {
    return `${sign} ${exclusive}`
  } else if (value) {
    return `${sign}${exclusive ? '' : '='} ${value}`
  }

  return
}

export type Items = Omit<OpenAPIV2.ItemsObject, 'exclusiveMaximum' | 'exclusiveMinimum' | 'type'> & {
  const?: unknown
  exclusiveMaximum?: boolean | number
  exclusiveMinimum?: boolean | number
  items?: SchemaObject
  type?: string | string[]
}
