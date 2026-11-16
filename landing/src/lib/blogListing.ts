import type { BlogListingProps } from '@/components/blog/BlogListing'
import { getAllArticles } from '@/lib/blog'
import { getLeadArticle, getTags, tagSlug } from '@/lib/blogGrouping'
import { Article } from '@/utils/types'

/**
 * Props for the blog's listing routes: /blog and /blog/tag/<slug>.
 *
 * The lead post sits above the list on every one of them, so the lists skip
 * it rather than show it twice.
 *
 * BUILD TIME ONLY, like `@/lib/blog`, which it reads posts through.
 */

const BLOG_DESCRIPTION =
  'The latest Nhost news, product updates, engineering deep-dives, and developer guides on Postgres, GraphQL, Auth, and more.'

/** The posts a listing shows: `tag`'s posts, or all, minus the lead. */
function getListedArticles(articles: Article[], tag?: string): Article[] {
  const lead = getLeadArticle(articles)

  return articles.filter(
    (article) =>
      article !== lead && (tag === undefined || article.tags.includes(tag)),
  )
}

/** /blog. */
export async function getBlogListingProps(): Promise<BlogListingProps> {
  const articles = await getAllArticles()

  return {
    seo: {
      path: '/blog',
      title: 'Blog: Product News and Dev Guides',
      description: BLOG_DESCRIPTION,
    },
    lead: getLeadArticle(articles),
    articles: getListedArticles(articles),
    searchable: articles,
    tags: getTags(articles),
    activeTag: null,
  }
}

/** Every tag's slug. */
export async function getTagSlugs(): Promise<string[]> {
  return getTags(await getAllArticles()).map(tagSlug)
}

/** A tag's listing, or `null` when `slug` is not a tag. */
export async function getTagListingProps(
  slug: string,
): Promise<BlogListingProps | null> {
  const articles = await getAllArticles()
  const tags = getTags(articles)
  const tag = tags.find((candidate) => tagSlug(candidate) === slug)

  if (!tag) {
    return null
  }

  return {
    seo: {
      path: `/blog/tag/${slug}`,
      title: `${tag} posts on the Nhost blog`,
      description: `Nhost blog posts about ${tag}, newest first.`,
    },
    lead: getLeadArticle(articles),
    articles: getListedArticles(articles, tag),
    searchable: articles.filter((article) => article.tags.includes(tag)),
    tags,
    activeTag: tag,
  }
}
