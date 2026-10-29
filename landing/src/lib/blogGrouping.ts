import { Article } from '@/utils/types'

/**
 * Pure helpers for arranging posts.
 *
 * Deliberately separate from `@/lib/blog`: that module reads the filesystem
 * (fast-glob) and can only run at build time, while these run in the browser
 * too, for the blog's search. Importing the loader into a client component
 * pulls `fs` into the bundle and fails the build.
 */

/** Posts per listing page, on /blog and on tag pages. */
export const POSTS_PER_PAGE = 12

/** How many tags the filter row shows before the rest go in "More". */
export const TAG_ROW_SIZE = 7

/**
 * Tags on fewer posts than this get no page and no filter. Most tags appear
 * once, which makes them noise as filters and thin as pages.
 */
export const MIN_POSTS_PER_TAG = 3

/** The newest post flagged `featured`, which leads /blog. */
export function getLeadArticle(articles: Article[]): Article | null {
  return articles.find((article) => article.featured) ?? null
}

/**
 * Tags on at least `MIN_POSTS_PER_TAG` posts, ordered by how many posts carry
 * them, then alphabetically.
 */
export function getPopularTags(articles: Article[]): string[] {
  const counts = new Map<string, number>()

  for (const article of articles) {
    for (const tag of article.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(counts)
    .filter(([, count]) => count >= MIN_POSTS_PER_TAG)
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .map(([tag]) => tag)
}

/** URL segment for a tag: `Next.js` is `nextjs`, `Open Source` is `open-source`. */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Path of a tag's listing, or of one of its later pages. */
export function tagPath(tag: string, page = 1): string {
  return listingPath(`/blog/tag/${tagSlug(tag)}`, page)
}

/** Page 1 lives at `basePath` itself; later pages add `/page/<n>`. */
export function listingPath(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}/page/${page}`
}

/** Number of pages `count` posts fill. Always at least one. */
export function pageCount(count: number): number {
  return Math.max(1, Math.ceil(count / POSTS_PER_PAGE))
}

/** The posts on `page`, counting from 1. */
export function getPage(articles: Article[], page: number): Article[] {
  const start = (page - 1) * POSTS_PER_PAGE

  return articles.slice(start, start + POSTS_PER_PAGE)
}

/** `/blog/<segment>` paths that belong to listings, not posts. */
const RESERVED_POST_SLUGS = new Set(['page', 'tag'])

/**
 * Problems that would make two blog URLs collide: a post whose slug a listing
 * route already uses, or popular tags that share a slug and so a page. Empty
 * when there are none.
 */
export function findUrlClashes(articles: Article[]): string[] {
  const problems = articles
    .filter((article) => RESERVED_POST_SLUGS.has(article.slug))
    .map(
      (article) =>
        `Post "${article.slug}" uses a URL reserved for blog listings. Rename it.`,
    )

  const tagsBySlug = new Map<string, string[]>()

  for (const tag of getPopularTags(articles)) {
    const slug = tagSlug(tag)
    tagsBySlug.set(slug, [...(tagsBySlug.get(slug) ?? []), tag])
  }

  for (const [slug, tags] of Array.from(tagsBySlug)) {
    if (tags.length > 1) {
      problems.push(
        `Tags ${tags
          .map((tag) => `"${tag}"`)
          .join(', ')} all map to /blog/tag/${slug}. Merge or rename them.`,
      )
    }
  }

  return problems
}

/**
 * Parses a `[page]` route param. Returns `null` for anything that is not a
 * page past the first and within `totalPages`, so the route can 404. Page 1 is
 * rejected because it lives at the listing's base path.
 */
export function parsePageParam(
  param: string | string[] | undefined,
  totalPages: number,
): number | null {
  if (typeof param !== 'string' || !/^[1-9]\d*$/.test(param)) {
    return null
  }

  const page = Number(param)

  return page >= 2 && page <= totalPages ? page : null
}
