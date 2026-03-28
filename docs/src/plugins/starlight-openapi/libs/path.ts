import type { AstroConfig } from 'astro'
import { slug } from 'github-slugger'

import type { StarlightOpenAPISchemaConfig } from './schema'
import type { StarlightOpenAPIContext } from './vite'

export { slug } from 'github-slugger'

const base = stripTrailingSlash(import.meta.env.BASE_URL)

const trailingSlashTransformers: Record<AstroConfig['trailingSlash'], TrailingSlashTransformer> = {
  always: ensureTrailingSlash,
  ignore: ensureTrailingSlash,
  never: stripTrailingSlash,
}

export function getTrailingSlashTransformer(context: StarlightOpenAPIContext) {
  return trailingSlashTransformers[context.trailingSlash]
}

/**
 * Does not take the Astro `base` configuration option into account.
 * @see {@link getBaseLink} for a link that does.
 */
export function getBasePath(config: StarlightOpenAPISchemaConfig) {
  const path = config.base
    .split('/')
    .map((part) => slug(part))
    .join('/')

  return `/${path}/`
}

/**
 * Takes the Astro `base` configuration option into account.
 * @see {@link getBasePath} for a slug that does not.
 */
export function getBaseLink(config: StarlightOpenAPISchemaConfig, context?: StarlightOpenAPIContext) {
  const path = stripLeadingSlash(getBasePath(config))
  const baseLink = path ? `${base}/${path}` : `${base}/`

  return context ? getTrailingSlashTransformer(context)(baseLink) : baseLink
}

export function stripLeadingAndTrailingSlashes(path: string): string {
  return stripLeadingSlash(stripTrailingSlash(path))
}

function stripLeadingSlash(path: string) {
  if (!path.startsWith('/')) {
    return path
  }

  return path.slice(1)
}

function stripTrailingSlash(path: string) {
  if (!path.endsWith('/')) {
    return path
  }

  return path.slice(0, -1)
}

function ensureTrailingSlash(path: string) {
  if (path.endsWith('/')) {
    return path
  }

  return `${path}/`
}

type TrailingSlashTransformer = (path: string) => string
