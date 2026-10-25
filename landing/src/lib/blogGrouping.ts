import { blogCategories, BlogCategorySlug } from '@/data/blogCategories'
import { Article } from '@/utils/types'

/**
 * Pure helpers for arranging posts.
 *
 * Deliberately separate from `@/lib/blog`: that module reads the filesystem
 * (fast-glob) and can only run at build time, while these run in the browser
 * too, for the blog's search and category filter. Importing the loader into a
 * client component pulls `fs` into the bundle and fails the build.
 */

/** Posts flagged `featured`, preserving the order they came in. */
export function getFeaturedArticles(articles: Article[]): Article[] {
  return articles.filter((article) => article.featured)
}

/**
 * Tags never offered as filters: catch-alls on so many posts that they narrow
 * almost nothing, and tags that repeat a category, which the category columns
 * and pages already cover.
 */
const EXCLUDED_TAGS = new Set([
  'Product',
  'Company',
  'Guide',
  'Guides',
  'Engineering',
  'Comparison',
  'Customer',
])

/** Tags always offered as filters, even below `minPosts`: topics we push. */
const INCLUDED_TAGS = new Set(['MCP'])

/**
 * Tags worth offering as filters: on at least `minPosts` posts or in
 * `INCLUDED_TAGS`, and not in `EXCLUDED_TAGS`. Most tags appear once, which
 * makes them noise as buttons. Ordered by how many posts carry them, then
 * alphabetically.
 */
export function getPopularTags(articles: Article[], minPosts = 3): string[] {
  const counts = new Map<string, number>()

  for (const article of articles) {
    for (const tag of article.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(counts)
    .filter(
      ([tag, count]) =>
        (count >= minPosts || INCLUDED_TAGS.has(tag)) &&
        !EXCLUDED_TAGS.has(tag),
    )
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .map(([tag]) => tag)
}

export interface ArticlesByCategory {
  slug: BlogCategorySlug
  label: string
  description: string
  articles: Article[]
}

/**
 * Posts grouped into the categories declared in `@/data/blogCategories`, in
 * that declared order. Categories with no posts are dropped so an empty
 * section never renders.
 */
export function groupArticlesByCategory(
  articles: Article[],
): ArticlesByCategory[] {
  return blogCategories
    .map((category) => ({
      slug: category.slug,
      label: category.label,
      description: category.description,
      articles: articles.filter(
        (article) => article.category === category.slug,
      ),
    }))
    .filter((group) => group.articles.length > 0)
}
