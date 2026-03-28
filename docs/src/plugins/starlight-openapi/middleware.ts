import { defineRouteMiddleware } from '@astrojs/starlight/route-data'
import projectContext from 'virtual:starlight-openapi-context'
import schemas from 'virtual:starlight-openapi-schemas'

import { stripLeadingAndTrailingSlashes } from './libs/path'
import { getSidebarFromSchemas } from './libs/starlight'

const allSchemas = Object.values(schemas)

export const onRequest = defineRouteMiddleware((context) => {
  const { starlightRoute } = context.locals
  const { sidebar } = starlightRoute

  starlightRoute.sidebar = getSidebarFromSchemas(
    stripLeadingAndTrailingSlashes(context.url.pathname),
    sidebar,
    allSchemas,
    projectContext,
  )
})
