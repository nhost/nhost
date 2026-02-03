import type { AstroIntegration } from 'astro'
import path from 'node:path'

import type { Schema } from './schema'
import { vitePluginStarlightOpenAPI } from './vite'

export function starlightOpenAPIIntegration(schemas: Schema[], pluginDir: string): AstroIntegration {
  const starlightOpenAPI: AstroIntegration = {
    name: 'starlight-openapi',
    hooks: {
      'astro:config:setup': ({ config, injectRoute, updateConfig }) => {
        injectRoute({
          entrypoint: path.join(pluginDir, 'components', 'Route.astro'),
          pattern: `[...openAPISlug]`,
          prerender: true,
        })

        updateConfig({
          vite: {
            plugins: [vitePluginStarlightOpenAPI(schemas, { trailingSlash: config.trailingSlash })],
          },
        })
      },
    },
  }

  return starlightOpenAPI
}
