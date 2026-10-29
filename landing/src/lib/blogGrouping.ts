import { Article } from '@/utils/types'

/**
 * Pure helpers for arranging posts.
 *
 * Deliberately separate from `@/lib/blog`: that module reads the filesystem
 * (fast-glob) and can only run at build time, while these run in the browser
 * too, for the blog's search. Importing the loader into a client component
 * pulls `fs` into the bundle and fails the build.
 */

/**
 * Posts a listing shows at first, on /blog and on tag pages, and how many more
 * each "Show more posts" click reveals.
 */
export const POSTS_PER_BATCH = 9

/** How many tags the filter row shows, most used first. */
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

/** URL segment for a tag: `Next.js` is `nextjs`, `Open Source` is `open-source`. */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Path of a tag's listing. */
export function tagPath(tag: string): string {
  return `/blog/tag/${tagSlug(tag)}`
}

/** `/blog/<segment>` paths that belong to listings, not posts. */
const RESERVED_POST_SLUGS = new Set(['tag'])

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
