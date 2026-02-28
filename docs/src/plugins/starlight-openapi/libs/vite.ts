import type { AstroConfig, ViteUserConfig } from 'astro'

import type { Schema } from './schema'

export function vitePluginStarlightOpenAPI(schemas: Schema[], context: StarlightOpenAPIContext): VitePlugin {
  const modules = {
    'virtual:starlight-openapi-schemas': `export default ${JSON.stringify(
      Object.fromEntries(schemas.map((schema) => [schema.config.base, schema])),
    )}`,
    'virtual:starlight-openapi-context': `export default ${JSON.stringify(context)}`,
  }

  const moduleResolutionMap = Object.fromEntries(
    (Object.keys(modules) as (keyof typeof modules)[]).map((key) => [resolveVirtualModuleId(key), key]),
  )

  return {
    name: 'vite-plugin-starlight-openapi',
    load(id) {
      const moduleId = moduleResolutionMap[id]
      return moduleId ? modules[moduleId] : undefined
    },
    resolveId(id) {
      return id in modules ? resolveVirtualModuleId(id) : undefined
    },
  }
}

function resolveVirtualModuleId<TModuleId extends string>(id: TModuleId): `\0${TModuleId}` {
  return `\0${id}`
}

export interface StarlightOpenAPIContext {
  trailingSlash: AstroConfig['trailingSlash']
}

type VitePlugin = NonNullable<ViteUserConfig['plugins']>[number]
