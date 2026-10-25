import { blogCategories, getBlogCategory } from '@/data/blogCategories'
import { Article } from '@/utils/types'
import glob from 'fast-glob'
import * as path from 'path'

/**
 * Loads blog posts from disk.
 *
 * Posts are MDX files in `src/pages/blog`, each exporting an `article` object.
 *
 * BUILD TIME ONLY. It reads the filesystem, so importing it from a component
 * that also runs in the browser pulls `fs` into the client bundle and fails the
 * build. Arranging posts for the UI lives in `@/lib/blogGrouping`, which is
 * pure and safe to import anywhere.
 */

const BLOG_PAGES_DIR = path.join(process.cwd(), 'src/pages/blog')

async function importArticle(articleFilename: string): Promise<Article> {
  // The path is relative to THIS file, not to cwd, so webpack can build a
  // context for the blog directory and resolve the dynamic import. The
  // webpackInclude narrows that context to the posts themselves, so the other
  // files in src/pages/blog (index.tsx, the category page) stay out of it.
  const { article } = await import(
    /* webpackInclude: /\.mdx$/ */ `../pages/blog/${articleFilename}`
  )

  return {
    ...article,
    slug: articleFilename.replace(/(\/index)?\.mdx$/, ''),
  }
}

/**
 * MDX files are not typechecked, so `Article['category']` alone does not stop a
 * post shipping without a category (it would just vanish from every section).
 * Checking here turns that into a build failure naming the file.
 */
function assertCategories(articles: Article[]): void {
  const invalid = articles
    .filter((article) => !getBlogCategory(article.category))
    .map((article) =>
      article.category
        ? `${article.slug} (unknown category '${article.category}')`
        : `${article.slug} (no category)`,
    )

  if (invalid.length > 0) {
    throw new Error(
      `Blog posts with a missing or unknown category:\n  ${invalid.join(
        '\n  ',
      )}\n` +
        `Valid categories: ${blogCategories.map((c) => c.slug).join(', ')}. ` +
        `See src/data/blogCategories.ts.`,
    )
  }
}

/** Every post, newest first. */
export async function getAllArticles(): Promise<Article[]> {
  const articleFilenames = await glob(['*.mdx', '*/index.mdx'], {
    cwd: BLOG_PAGES_DIR,
  })

  const articles = await Promise.all(articleFilenames.map(importArticle))

  assertCategories(articles)

  return articles.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}
