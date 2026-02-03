import type { StarlightRouteData } from '@astrojs/starlight/route-data'
import type { HookParameters } from '@astrojs/starlight/types'
import type { MarkdownHeading } from 'astro'

import { getCallbacks } from './callback'
import type { OperationHttpMethod, OperationTag, PathItemOperation } from './operation'
import { getParametersByLocation } from './parameter'
import { slug, stripLeadingAndTrailingSlashes } from './path'
import { hasRequestBody } from './requestBody'
import { includesDefaultResponse } from './response'
import { getSchemaSidebarGroups, type Schema } from './schema'
import { getSecurityDefinitions, getSecurityRequirements } from './security'
import { capitalize } from './utils'
import type { StarlightOpenAPIContext } from './vite'

const starlightOpenAPISidebarGroupsLabel = Symbol('StarlightOpenAPISidebarGroupsLabel')

export function getSidebarGroupsPlaceholder(): SidebarManualGroupConfig[] {
  return [getSidebarGroupPlaceholder(starlightOpenAPISidebarGroupsLabel)]
}

export function getSidebarGroupPlaceholder(label: symbol): SidebarManualGroupConfig {
  return {
    collapsed: false,
    items: [],
    label: label.toString(),
  }
}

export function getPageProps(
  title: string,
  schema: Schema,
  pathItemOperation?: PathItemOperation,
  tag?: OperationTag,
): StarlightPageProps {
  const isOverview = pathItemOperation === undefined
  const isOperationTag = tag !== undefined

  return {
    frontmatter: {
      title,
    },
    headings: isOperationTag
      ? getOperationTagHeadings(tag)
      : isOverview
        ? getOverviewHeadings(schema)
        : getOperationHeadings(schema, pathItemOperation),
  }
}

export function getSidebarFromSchemas(
  pathname: string,
  sidebar: StarlightRouteData['sidebar'],
  schemas: Schema[],
  context: StarlightOpenAPIContext,
): StarlightRouteData['sidebar'] {
  if (sidebar.length === 0) {
    return sidebar
  }

  const sidebarGroups = schemas.map((schema) =>
    getSchemaSidebarGroups(pathname, schema, context, starlightOpenAPISidebarGroupsLabel.toString()),
  )

  const sidebarGroupsMap: Record<string, SidebarGroup[]> = {}

  for (const [label, group] of sidebarGroups) {
    if (!sidebarGroupsMap[label]) sidebarGroupsMap[label] = []
    sidebarGroupsMap[label].push(group)
  }

  function replaceSidebarGroupsPlaceholder(group: SidebarGroup): SidebarGroup | SidebarGroup[] {
    const sidebarGroups = sidebarGroupsMap[group.label]

    if (sidebarGroups) {
      return sidebarGroups
    }

    if (isSidebarGroup(group)) {
      return {
        ...group,
        entries: group.entries.flatMap((item) => {
          return isSidebarGroup(item) ? replaceSidebarGroupsPlaceholder(item) : item
        }),
      }
    }

    return group
  }

  return sidebar.flatMap((item) => {
    return isSidebarGroup(item) ? replaceSidebarGroupsPlaceholder(item) : item
  })
}

export function makeSidebarGroup(label: string, entries: SidebarItem[], collapsed: boolean): SidebarGroup {
  return { type: 'group', collapsed, entries, label, badge: undefined }
}

export function makeSidebarLink(pathname: string, label: string, href: string, badge?: SidebarBadge): SidebarLink {
  return { type: 'link', isCurrent: pathname === stripLeadingAndTrailingSlashes(href), label, href, badge, attrs: {} }
}

export function getMethodSidebarBadge(method: OperationHttpMethod): SidebarBadge {
  return { class: `sl-openapi-method-${method}`, text: method.toUpperCase(), variant: 'caution' }
}

function isSidebarGroup(item: SidebarItem): item is SidebarGroup {
  return item.type === 'group'
}

function getOverviewHeadings({ document }: Schema): MarkdownHeading[] {
  const items: MarkdownHeading[] = [makeHeading(2, `${document.info.title} (${document.info.version})`, 'overview')]

  const securityDefinitions = getSecurityDefinitions(document)

  if (securityDefinitions) {
    items.push(
      makeHeading(2, 'Authentication'),
      ...Object.keys(securityDefinitions).map((name) => makeHeading(3, name)),
    )
  }

  return makeHeadings(items)
}

function getOperationTagHeadings(tag: OperationTag): MarkdownHeading[] {
  return [makeHeading(2, tag.name, 'overview')]
}

function getOperationHeadings(schema: Schema, { operation, pathItem }: PathItemOperation): MarkdownHeading[] {
  const items: MarkdownHeading[] = []

  const securityRequirements = getSecurityRequirements(operation, schema)

  if (securityRequirements && securityRequirements.length > 0) {
    items.push(makeHeading(2, 'Authorizations'))
  }

  const parametersByLocation = getParametersByLocation(operation.parameters, pathItem.parameters)

  if (parametersByLocation.size > 0) {
    items.push(
      makeHeading(2, 'Parameters'),
      ...[...parametersByLocation.keys()].map((location) => makeHeading(3, `${capitalize(location)} Parameters`)),
    )
  }

  if (hasRequestBody(operation)) {
    items.push(makeHeading(2, 'Request Body'))
  }

  const callbacks = getCallbacks(operation)
  const callbackIdentifiers = Object.keys(callbacks ?? {})

  if (callbackIdentifiers.length > 0) {
    items.push(makeHeading(2, 'Callbacks'), ...callbackIdentifiers.map((identifier) => makeHeading(3, identifier)))
  }

  if (operation.responses) {
    const responseItems: MarkdownHeading[] = []

    for (const name of Object.keys(operation.responses)) {
      if (name !== 'default') {
        responseItems.push(makeHeading(3, name))
      }
    }

    if (includesDefaultResponse(operation.responses)) {
      responseItems.push(makeHeading(3, 'default'))
    }

    items.push(makeHeading(2, 'Responses'), ...responseItems)
  }

  return makeHeadings(items)
}

function makeHeadings(items: MarkdownHeading[]): MarkdownHeading[] {
  return [makeHeading(1, 'Overview', '_top'), ...items]
}

function makeHeading(depth: number, text: string, customSlug?: string): MarkdownHeading {
  return { depth, slug: customSlug ?? slug(text), text }
}

type SidebarUserConfig = NonNullable<HookParameters<'config:setup'>['config']['sidebar']>

type SidebarItemConfig = SidebarUserConfig[number]
type SidebarManualGroupConfig = Extract<SidebarItemConfig, { items: SidebarItemConfig[] }>
export type StarlightOpenAPISidebarGroup = SidebarManualGroupConfig

type SidebarItem = StarlightRouteData['sidebar'][number]
type SidebarLink = Extract<SidebarItem, { type: 'link' }>
export type SidebarGroup = Extract<SidebarItem, { type: 'group' }>

type SidebarBadge = SidebarItem['badge']

interface StarlightPageProps {
  frontmatter: {
    title: string
  }
  headings: MarkdownHeading[]
}
