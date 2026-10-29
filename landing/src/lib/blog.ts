import { findUrlClashes } from '@/lib/blogGrouping'
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
  // files in src/pages/blog (the listing pages) stay out of it.
  const { article } = await import(
    /* webpackInclude: /\.mdx$/ */ `../pages/blog/${articleFilename}`
  )

  return {
    ...article,
    slug: articleFilename.replace(/(\/index)?\.mdx$/, ''),
  }
}

/** Every post, newest first. */
export async function getAllArticles(): Promise<Article[]> {
  const articleFilenames = await glob(['*.mdx', '*/index.mdx'], {
    cwd: BLOG_PAGES_DIR,
  })

  const articles = await Promise.all(articleFilenames.map(importArticle))
  const clashes = findUrlClashes(articles)

  if (clashes.length > 0) {
    throw new Error(`Blog URL clashes:\n  ${clashes.join('\n  ')}`)
  }

  return articles.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}
