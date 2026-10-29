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
export const POSTS_PER_PAGE = 9

/** How many tags the filter row shows before the rest go in "More". */
export const TAG_ROW_SIZE = 7

/** The newest post flagged `featured`, which leads /blog. */
export function getLeadArticle(articles: Article[]): Article | null {
  return articles.find((article) => article.featured) ?? null
}

/** Every tag, ordered by how many posts carry it, then alphabetically. */
export function getTags(articles: Article[]): string[] {
  const counts = new Map<string, number>()

  for (const article of articles) {
    for (const tag of article.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(counts)
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .map(([tag]) => tag)
}

/**
 * Splits `tags`, most used first, into the filter row's `TAG_ROW_SIZE` and the
 * rest for "More", A to Z ignoring case.
 */
export function splitTags(tags: string[]): {
  rowTags: string[]
  moreTags: string[]
} {
  return {
    rowTags: tags.slice(0, TAG_ROW_SIZE),
    moreTags: tags
      .slice(TAG_ROW_SIZE)
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
  }
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

/** Slots in the pagination row, gaps included. */
const PAGE_SLOTS = 8

/**
 * Page numbers to link from `page`, with `null` for a gap. Up to `PAGE_SLOTS`
 * pages it shows them all; past that the row always fills exactly that many
 * slots, keeping the first, the last, and the current page with its
 * neighbours: `1 2 3 4 5 6 … 20`, `1 … 9 10 11 12 … 20`,
 * `1 … 15 16 17 18 19 20`. Each gap hides at least two pages.
 */
export function getPageNumbers(
  page: number,
  totalPages: number,
): (number | null)[] {
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index)

  if (totalPages <= PAGE_SLOTS) {
    return range(1, totalPages)
  }

  if (page <= 4) {
    return [...range(1, 6), null, totalPages]
  }

  if (page >= totalPages - 4) {
    return [1, null, ...range(totalPages - 5, totalPages)]
  }

  return [1, null, page - 1, page, page + 1, page + 2, null, totalPages]
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
 * route already uses, or tags that share a slug and so a page. Empty
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

  for (const tag of getTags(articles)) {
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
