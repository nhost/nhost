import { NextSeoProps } from 'next-seo'

import { baseUrl } from './utils'

/**
 * Builds a self-referencing canonical URL for the given path.
 *
 * @param path - The page path, starting with a slash (e.g. `/pricing`).
 */
export function canonicalUrl(path: string): string {
  const normalized = path === '/' ? '' : path.replace(/\/$/, '')

  return `${baseUrl()}${normalized}`
}

export interface BuildSeoOptions {
  /** Page path, starting with a slash (e.g. `/product/auth`). */
  path: string
  /** SEO meta title. Keep the rendered title under 65 characters. */
  title?: string
  /** SEO meta description. Keep under 145 characters. */
  description?: string
}

/**
 * Produces a `NextSeoProps` object with a self-referencing canonical tag plus an
 * optional title and description, for use on real, user-facing pages.
 *
 * Note: an `index,follow` robots meta tag is already emitted on every page by
 * `next-seo` (via the `DefaultSeo` in `_app.tsx`), so it is intentionally not
 * duplicated here.
 */
export function buildSeo({
  path,
  title,
  description,
}: BuildSeoOptions): NextSeoProps {
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    canonical: canonicalUrl(path),
  }
}
