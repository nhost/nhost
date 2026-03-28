import { getOperationsByTag, getWebhooksOperations } from './operation'
import { getBaseLink, getTrailingSlashTransformer } from './path'
import type { Schema } from './schema'
import { getMethodSidebarBadge, makeSidebarGroup, makeSidebarLink, type SidebarGroup } from './starlight'
import type { StarlightOpenAPIContext } from './vite'

export function getPathItemSidebarGroups(
  pathname: string,
  schema: Schema,
  context: StarlightOpenAPIContext,
): SidebarGroup['entries'] {
  const { config } = schema
  const baseLink = getBaseLink(config)
  const operations = getOperationsByTag(schema)

  const tags =
    config.sidebar.tags.sort === 'alphabetical'
      ? [...operations.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      : [...operations.entries()]

  // Flatten all operations into a single list (no tag grouping)
  // Deduplicate by slug since operations with multiple tags appear in multiple groups
  const seenSlugs = new Set<string>()
  const allOperations = tags.flatMap(([, operations]) => operations.entries).filter((op) => {
    if (seenSlugs.has(op.slug)) {
      return false
    }
    seenSlugs.add(op.slug)
    return true
  })

  const sortedOperations =
    config.sidebar.operations.sort === 'alphabetical'
      ? allOperations.sort((a, b) => a.sidebar.label.localeCompare(b.sidebar.label))
      : allOperations

  return sortedOperations.map(({ method, sidebar, slug }) => {
    return makeSidebarLink(
      pathname,
      sidebar.label,
      getTrailingSlashTransformer(context)(baseLink + slug),
      config.sidebar.operations.badges ? getMethodSidebarBadge(method) : undefined,
    )
  })
}

export function getWebhooksSidebarGroups(
  pathname: string,
  schema: Schema,
  context: StarlightOpenAPIContext,
): SidebarGroup['entries'] {
  const { config } = schema
  const baseLink = getBaseLink(config)
  const operations = getWebhooksOperations(schema)

  if (operations.length === 0) {
    return []
  }

  const entries =
    config.sidebar.operations.sort === 'alphabetical'
      ? operations.sort((a, b) => a.sidebar.label.localeCompare(b.sidebar.label))
      : operations

  return [
    makeSidebarGroup(
      'Webhooks',
      entries.map(({ method, sidebar, slug }) =>
        makeSidebarLink(
          pathname,
          sidebar.label,
          getTrailingSlashTransformer(context)(baseLink + slug),
          config.sidebar.operations.badges ? getMethodSidebarBadge(method) : undefined,
        ),
      ),
      config.sidebar.collapsed,
    ),
  ]
}

export function isPathItem(pathItem: unknown): pathItem is PathItem {
  return typeof pathItem === 'object'
}

type Paths = NonNullable<Schema['document']['paths']>
export type PathItem = NonNullable<Paths[string]>
