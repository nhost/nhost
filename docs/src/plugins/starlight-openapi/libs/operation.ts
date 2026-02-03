import type { OpenAPI } from 'openapi-types'

import type { Callback } from './callback'
import { type Document, isOpenAPIV2Document } from './document'
import { slug } from './path'
import { isPathItem, type PathItem } from './pathItem'
import type { Schema } from './schema'

const defaultOperationTag = 'Operations'
const operationHttpMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

/**
 * Generate a URL-safe slug from method and path
 * e.g., "post", "/elevate/webauthn/verify" -> "post-elevate-webauthn-verify"
 * e.g., "get", "/.well-known/jwks.json" -> "get-well-known-jwks-json"
 */
function generateMethodPathSlug(method: string, pathUrl: string): string {
  const cleanPath = pathUrl
    .replace(/\{([^}]+)\}/g, '$1') // {id} -> id
    .replace(/[^a-zA-Z0-9/-]/g, '-') // Replace non-alphanumeric (except / and -) with -
    .replace(/\//g, '-') // Replace / with -
    .replace(/-+/g, '-') // Collapse multiple dashes
    .replace(/^-/, '') // Remove leading dash
    .replace(/-$/, '') // Remove trailing dash

  return `${method}${cleanPath ? '-' + cleanPath : ''}`
}

export function getOperationsByTag({ config, document }: Schema) {
  const operationsByTag = new Map<string, { entries: PathItemOperation[]; tag: OperationTag }>()

  for (const [pathItemPath, pathItem] of Object.entries(document.paths ?? {})) {
    if (!isPathItem(pathItem)) {
      continue
    }

    const allOperationIds = operationHttpMethods.map((method) => {
      return isPathItemOperation(pathItem, method) ? (pathItem[method].operationId ?? pathItemPath) : undefined
    })

    for (const [index, method] of operationHttpMethods.entries()) {
      const operationId = allOperationIds[index]

      if (!operationId || !isPathItemOperation(pathItem, method)) {
        continue
      }

      const operation = pathItem[method]
      const isDuplicateOperationId = allOperationIds.filter((id) => id === operationId).length > 1
      const methodPathSlug = generateMethodPathSlug(method, pathItemPath)

      for (const tag of operation.tags ?? [defaultOperationTag]) {
        const operations = operationsByTag.get(tag) ?? { entries: [], tag: { name: tag } }

        const title =
          operation.summary ?? (isDuplicateOperationId ? `${operationId} (${method.toUpperCase()})` : operationId)

        operations.entries.push({
          method,
          operation,
          path: pathItemPath,
          pathItem,
          sidebar: {
            label:
              config.sidebar.operations.labels === 'path'
                ? pathItemPath
                : config.sidebar.operations.labels === 'summary' && operation.summary
                  ? title
                  : operationId,
          },
          slug: methodPathSlug,
          title,
        })

        operationsByTag.set(tag, operations)
      }
    }
  }

  if (document.tags) {
    const orderedTags = new Map(document.tags.map((tag, index) => [tag.name, { index, tag }]))
    const operationsByTagArray = [...operationsByTag.entries()].sort(([tagA], [tagB]) => {
      const orderA = orderedTags.get(tagA)?.index ?? Number.POSITIVE_INFINITY
      const orderB = orderedTags.get(tagB)?.index ?? Number.POSITIVE_INFINITY

      return orderA - orderB
    })

    operationsByTag.clear()

    for (const [tag, operations] of operationsByTagArray) {
      operationsByTag.set(tag, { ...operations, tag: orderedTags.get(tag)?.tag ?? operations.tag })
    }
  }

  return operationsByTag
}

export function getWebhooksOperations({ config, document }: Schema): PathItemOperation[] {
  if (!('webhooks' in document)) {
    return []
  }

  const operations: PathItemOperation[] = []

  for (const [webhookKey, pathItem] of Object.entries(document.webhooks)) {
    if (!isPathItem(pathItem)) {
      continue
    }

    for (const method of operationHttpMethods) {
      if (!isPathItemOperation(pathItem, method)) {
        continue
      }

      const operation = pathItem[method]
      const operationId = operation.operationId ?? webhookKey

      const title = operation.summary ?? operationId

      operations.push({
        method,
        operation,
        pathItem,
        sidebar: {
          label: config.sidebar.operations.labels === 'summary' && operation.summary ? title : operationId,
        },
        slug: `webhooks/${slug(operationId)}`,
        title,
      })
    }
  }

  return operations
}

export function getCallbackOperations(callback: Callback): CallbackOperation[] {
  const operations: CallbackOperation[] = []

  for (const method of operationHttpMethods) {
    const operation = callback[method]
    if (!operation) continue

    operations.push({ method, operation })
  }

  return operations
}

export function isPathItemOperation<TMethod extends OperationHttpMethod>(
  pathItem: PathItem,
  method: TMethod,
): pathItem is Record<TMethod, Operation> {
  return method in pathItem
}

export function isMinimalOperationTag(tag: OperationTag): boolean {
  return (tag.description === undefined || tag.description.length === 0) && tag.externalDocs === undefined
}

export function getOperationURLs(document: Document, { operation, path, pathItem }: PathItemOperation): OperationURL[] {
  const urls: OperationURL[] = []

  if (isOpenAPIV2Document(document) && 'host' in document) {
    let url = document.host
    url += document.basePath ?? ''
    url += path ?? ''

    if (url.length > 0) {
      urls.push(makeOperationURL(url))
    }
  } else {
    const servers =
      'servers' in operation
        ? operation.servers
        : 'servers' in pathItem
          ? pathItem.servers
          : 'servers' in document
            ? document.servers
            : []

    for (const server of servers) {
      let url = server.url
      url += path ?? ''

      if (url.length > 0) {
        urls.push(makeOperationURL(url, server.description))
      }
    }
  }

  return urls
}

function makeOperationURL(url: string, description?: string): OperationURL {
  return { description, url: url.replace(/^\/\//, '') }
}

export interface PathItemOperation {
  method: OperationHttpMethod
  operation: Operation
  path?: string
  pathItem: PathItem
  sidebar: {
    label: string
  }
  slug: string
  title: string
}

export interface CallbackOperation {
  method: OperationHttpMethod
  operation: Operation
}

export type Operation = OpenAPI.Operation
export type OperationHttpMethod = (typeof operationHttpMethods)[number]
export type OperationTag = NonNullable<Document['tags']>[number]

export interface OperationURL {
  description?: string | undefined
  url: string
}
