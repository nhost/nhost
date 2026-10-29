import type { BlogListingProps } from '@/components/blog/BlogListing'
import { getAllArticles } from '@/lib/blog'
import {
  getLeadArticle,
  getPage,
  getPopularTags,
  listingPath,
  pageCount,
  tagSlug,
} from '@/lib/blogGrouping'

/**
 * Props for the blog's listing routes: /blog, /blog/page/<n>, and the same
 * under /blog/tag/<slug>.
 *
 * BUILD TIME ONLY, like `@/lib/blog`, which it reads posts through.
 */

const BLOG_DESCRIPTION =
  'The latest Nhost news, product updates, engineering deep-dives, and developer guides on Postgres, GraphQL, Auth, and more.'

/**
 * /blog and its later pages. The lead post sits above the list on page 1, so
 * the list skips it on every page to keep the pages consistent.
 */
export async function getBlogListingProps(
  page: number,
): Promise<BlogListingProps> {
  const articles = await getAllArticles()
  const lead = getLeadArticle(articles)
  const listed = articles.filter((article) => article !== lead)

  return {
    heading: 'Blog',
    subheading: 'Read the latest news about Nhost.',
    seo: {
      path: listingPath('/blog', page),
      title:
        page === 1
          ? 'Blog: Product News and Dev Guides'
          : `Blog: Product News and Dev Guides, page ${page}`,
      description:
        page === 1 ? BLOG_DESCRIPTION : `${BLOG_DESCRIPTION} Page ${page}.`,
    },
    basePath: '/blog',
    lead: page === 1 ? lead : null,
    articles: getPage(listed, page),
    searchable: articles,
    tags: getPopularTags(articles),
    activeTag: null,
    page,
    totalPages: pageCount(listed.length),
  }
}

/** How many pages /blog's list fills. */
export async function getBlogPageCount(): Promise<number> {
  const articles = await getAllArticles()
  const lead = getLeadArticle(articles)

  return pageCount(articles.length - (lead ? 1 : 0))
}

/** Every popular tag with the number of pages its listing fills. */
export async function getTagPageCounts(): Promise<
  { slug: string; totalPages: number }[]
> {
  const articles = await getAllArticles()

  return getPopularTags(articles).map((tag) => ({
    slug: tagSlug(tag),
    totalPages: pageCount(
      articles.filter((article) => article.tags.includes(tag)).length,
    ),
  }))
}

/**
 * A tag's listing, or `null` when `slug` is not a popular tag or `page` is
 * past its last page.
 */
export async function getTagListingProps(
  slug: string,
  page: number,
): Promise<BlogListingProps | null> {
  const articles = await getAllArticles()
  const tags = getPopularTags(articles)
  const tag = tags.find((candidate) => tagSlug(candidate) === slug)

  if (!tag) {
    return null
  }

  const tagged = articles.filter((article) => article.tags.includes(tag))
  const totalPages = pageCount(tagged.length)

  if (page > totalPages) {
    return null
  }

  const basePath = `/blog/tag/${slug}`
  const description = `Nhost blog posts about ${tag}, newest first.`

  return {
    heading: tag,
    subheading: description,
    seo: {
      path: listingPath(basePath, page),
      title:
        page === 1
          ? `${tag} posts on the Nhost blog`
          : `${tag} posts on the Nhost blog, page ${page}`,
      description: page === 1 ? description : `${description} Page ${page}.`,
    },
    basePath,
    lead: null,
    articles: getPage(tagged, page),
    searchable: tagged,
    tags,
    activeTag: tag,
    page,
    totalPages,
  }
}
