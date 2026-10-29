import { Article } from '@/utils/types'

/**
 * Pure helpers for arranging posts.
 *
 * Deliberately separate from `@/lib/blog`: that module reads the filesystem
 * (fast-glob) and can only run at build time, while these run in the browser
 * too, for the blog's search. Importing the loader into a client component
 * pulls `fs` into the bundle and fails the build.
 */

/** Posts flagged `featured`, preserving the order they came in. */
export function getFeaturedArticles(articles: Article[]): Article[] {
  return articles.filter((article) => article.featured)
}

/**
 * Tags on at least `minPosts` posts. Most tags appear once, which makes them
 * noise as filters. Ordered by how many posts carry them, then alphabetically.
 */
export function getPopularTags(articles: Article[], minPosts = 3): string[] {
  const counts = new Map<string, number>()

  for (const article of articles) {
    for (const tag of article.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(counts)
    .filter(([, count]) => count >= minPosts)
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .map(([tag]) => tag)
}
