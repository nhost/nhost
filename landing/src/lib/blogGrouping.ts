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
