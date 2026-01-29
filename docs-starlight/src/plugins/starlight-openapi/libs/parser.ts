import { bundle } from '@readme/openapi-parser'
import type { AstroIntegrationLogger } from 'astro'

import type { Schema, StarlightOpenAPISchemaConfig } from './schema'

export async function parseSchema(
  logger: AstroIntegrationLogger,
  config: StarlightOpenAPISchemaConfig,
): Promise<Schema> {
  try {
    logger.info(`Parsing OpenAPI schema at '${config.schema}'.`)

    const document = await bundle(config.schema)

    return { config, document }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message)
    }

    throw error
  }
}
