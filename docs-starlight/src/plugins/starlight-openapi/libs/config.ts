import type { AstroIntegrationLogger } from 'astro'
import { AstroError } from 'astro/errors'
import { z } from 'astro/zod'

import { SchemaConfigSchema } from './schema'

const configSchema = z.array(SchemaConfigSchema).min(1)

export function validateConfig(logger: AstroIntegrationLogger, userConfig: unknown): StarlightOpenAPIConfig {
  const config = configSchema.safeParse(userConfig)

  if (!config.success) {
    const errors = config.error.flatten()

    logger.error('Invalid starlight-openapi configuration.')

    throw new AstroError(
      `
${errors.formErrors.map((formError) => ` - ${formError}`).join('\n')}
${Object.entries(errors.fieldErrors)
  .map(([fieldName, fieldErrors]) => ` - ${fieldName}: ${(fieldErrors ?? []).join(' - ')}`)
  .join('\n')}
  `,
      `See the error report above for more informations.\n\nIf you believe this is a bug, please file an issue at https://github.com/HiDeoo/starlight-openapi/issues/new/choose`,
    )
  }

  return config.data
}

export type StarlightOpenAPIUserConfig = z.input<typeof configSchema>
export type StarlightOpenAPIConfig = z.output<typeof configSchema>
