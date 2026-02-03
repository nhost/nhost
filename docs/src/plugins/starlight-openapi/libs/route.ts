import schemas from 'virtual:starlight-openapi-schemas'

import {
  getOperationsByTag,
  getWebhooksOperations,
  isMinimalOperationTag,
  type OperationTag,
  type PathItemOperation,
} from './operation'
import { getBasePath, slug, stripLeadingAndTrailingSlashes } from './path'
import type { Schema } from './schema'

export function getSchemaStaticPaths(): StarlighOpenAPIRoute[] {
  return Object.values(schemas).flatMap((schema) => [
    {
      params: {
        openAPISlug: stripLeadingAndTrailingSlashes(getBasePath(schema.config)),
      },
      props: {
        schema,
        type: 'overview',
      },
    },
    ...getPathItemStaticPaths(schema),
    ...getWebhooksStaticPaths(schema),
  ])
}

function getPathItemStaticPaths(schema: Schema): StarlighOpenAPIRoute[] {
  const baseLink = getBasePath(schema.config)
  const operations = getOperationsByTag(schema)

  return [...operations.entries()].flatMap(([, operations]) => {
    const paths: StarlighOpenAPIRoute[] = operations.entries.map((operation) => {
      return {
        params: {
          openAPISlug: stripLeadingAndTrailingSlashes(baseLink + operation.slug),
        },
        props: {
          operation,
          schema,
          type: 'operation',
        },
      }
    })

    if (!isMinimalOperationTag(operations.tag)) {
      paths.unshift({
        params: {
          openAPISlug: stripLeadingAndTrailingSlashes(`${baseLink}operations/tags/${slug(operations.tag.name)}`),
        },
        props: {
          schema,
          tag: operations.tag,
          type: 'operation-tag',
        },
      })
    }

    return paths
  })
}

function getWebhooksStaticPaths(schema: Schema): StarlighOpenAPIRoute[] {
  const baseLink = getBasePath(schema.config)
  const operations = getWebhooksOperations(schema)

  return operations.map((operation) => ({
    params: {
      openAPISlug: stripLeadingAndTrailingSlashes(baseLink + operation.slug),
    },
    props: {
      operation,
      schema,
      type: 'operation',
    },
  }))
}

interface StarlighOpenAPIRoute {
  params: {
    openAPISlug: string
  }
  props: StarlighOpenAPIRouteOverviewProps | StarlighOpenAPIRouteOperationProps | StarlighOpenAPIRouteOperationTagProps
}

interface StarlighOpenAPIRouteOverviewProps {
  schema: Schema
  type: 'overview'
}

interface StarlighOpenAPIRouteOperationProps {
  operation: PathItemOperation
  schema: Schema
  type: 'operation'
}

interface StarlighOpenAPIRouteOperationTagProps {
  schema: Schema
  tag: OperationTag
  type: 'operation-tag'
}
