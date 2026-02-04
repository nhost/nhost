import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import type { StarlightPlugin } from '@astrojs/starlight/types'

import { validateConfig, type StarlightOpenAPIUserConfig } from './libs/config'
import { starlightOpenAPIIntegration } from './libs/integration'
import { parseSchema } from './libs/parser'
import { getSidebarGroupPlaceholder, getSidebarGroupsPlaceholder } from './libs/starlight'

// Get the directory of this plugin
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const openAPISidebarGroups = getSidebarGroupsPlaceholder()

export default function starlightOpenAPIPlugin(userConfig: StarlightOpenAPIUserConfig): StarlightPlugin {
  return {
    name: 'starlight-openapi-plugin',
    hooks: {
      'config:setup': async ({
        addIntegration,
        addRouteMiddleware,
        command,
        config: starlightConfig,
        logger,
        updateConfig,
      }) => {
        if (command !== 'build' && command !== 'dev') {
          return
        }

        const config = validateConfig(logger, userConfig)
        const schemas = await Promise.all(config.map((schemaConfig) => parseSchema(logger, schemaConfig)))

        addRouteMiddleware({ entrypoint: path.join(__dirname, 'middleware.ts'), order: 'post' })
        addIntegration(starlightOpenAPIIntegration(schemas, __dirname))

        const updatedConfig: Parameters<typeof updateConfig>[0] = {
          customCss: [...(starlightConfig.customCss ?? []), path.join(__dirname, 'styles.css')],
        }

        if (updatedConfig.expressiveCode !== false) {
          updatedConfig.expressiveCode =
            updatedConfig.expressiveCode === true || updatedConfig.expressiveCode === undefined
              ? {}
              : updatedConfig.expressiveCode
          updatedConfig.expressiveCode.removeUnusedThemes = false
          updatedConfig.expressiveCode.defaultProps = {
            ...updatedConfig.expressiveCode.defaultProps,
            frame: 'none',
          }
        }

        updateConfig(updatedConfig)
      },
    },
  }
}

export function createOpenAPISidebarGroup() {
  return getSidebarGroupPlaceholder(Symbol(randomBytes(24).toString('base64url')))
}
