import { BlogLeadPost } from '@/components/blog/BlogLeadPost'
import { BlogPagination } from '@/components/blog/BlogPagination'
import { BlogPostGrid } from '@/components/blog/BlogPostGrid'
import { BlogSearchField } from '@/components/blog/BlogSearchField'
import { BlogTagRow } from '@/components/blog/BlogTagRow'
import { Container } from '@/components/common/Container'
import { Layout } from '@/components/common/Layout'
import { useArticleSearch } from '@/hooks/useArticleSearch'
import { POSTS_PER_PAGE } from '@/lib/blogGrouping'
import { buildSeo, BuildSeoOptions } from '@/utils/seo'
import { Article } from '@/utils/types'

export interface BlogListingProps {
  /** The page's h1. */
  heading: string
  subheading: string
  seo: BuildSeoOptions
  /** The listing's page 1, e.g. `/blog` or `/blog/tag/auth`. */
  basePath: string
  /** Shown above the toolbar on every listing; the lists leave it out. */
  lead: Article | null
  /** This page's posts. */
  articles: Article[]
  /** Posts across every page of the listing. */
  totalPosts: number
  /** Every post the search covers: the whole listing, not just this page. */
  searchable: Article[]
  /** Popular tags, most used first. */
  tags: string[]
  /** The tag whose listing this is, or `null` on /blog. */
  activeTag: string | null
  page: number
  totalPages: number
}

/**
 * The blog's listing pages: an optional lead post, a toolbar with search and
 * tags, then a page of posts.
 *
 * Searching swaps the page for every match across `searchable`. Without a
 * search, the prerendered HTML holds this page's posts and links to the
 * neighbouring pages, so crawlers reach every post without JavaScript.
 *
 * Renders its own `Layout` rather than using `getLayout`: `_app.tsx` hands
 * `getLayout` a `PlausibleProvider` element, not the page, so per-page SEO
 * props can't be read there.
 */
export default function BlogListing({
  heading,
  subheading,
  seo,
  basePath,
  lead,
  articles,
  totalPosts,
  searchable,
  tags,
  activeTag,
  page,
  totalPages,
}: BlogListingProps) {
  const { query, setQuery, isSearching, results } = useArticleSearch(searchable)

  const firstOnPage = (page - 1) * POSTS_PER_PAGE + 1
  const count = isSearching
    ? `${results.length} of ${searchable.length} posts`
    : `${firstOnPage}–${
        firstOnPage + articles.length - 1
      } of ${totalPosts} posts`

  let sectionHeading = 'All posts'

  if (isSearching) {
    sectionHeading = 'Search results'
  } else if (activeTag) {
    sectionHeading = `Posts tagged ${activeTag}`
  }

  return (
    <Layout slotProps={{ nextSeo: buildSeo(seo) }}>
      <Container className="grid max-w-5xl grid-cols-1 gap-10 pb-16 pt-14 lg:pb-28 lg:pt-20">
        <header className="grid grid-flow-row gap-2">
          <h1 className="font-mona text-3.5xl font-semibold text-white md:text-4.5xl">
            {heading}
          </h1>
          <p className="text-base text-white text-opacity-65">{subheading}</p>
        </header>

        {lead && !isSearching && <BlogLeadPost article={lead} />}

        <section className="grid grid-cols-1 gap-8">
          <div className="grid grid-cols-1 gap-4 border-b border-divider pb-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-mona text-2xl font-semibold text-white">
                {sectionHeading}
              </h2>
              <p
                role="status"
                className="shrink-0 text-sm tabular-nums text-white text-opacity-50"
              >
                {count}
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <BlogTagRow tags={tags} activeTag={activeTag} />

              <BlogSearchField
                id="blog-search"
                label={
                  activeTag ? `Search ${activeTag} posts` : 'Search the blog'
                }
                placeholder={
                  activeTag ? `Search ${activeTag} posts` : undefined
                }
                value={query}
                onChange={setQuery}
                className="md:max-w-[16rem] md:shrink-0"
              />
            </div>
          </div>

          {isSearching && results.length === 0 && (
            <p className="text-sm text-white text-opacity-65">
              No posts match.
            </p>
          )}

          {isSearching && results.length > 0 && (
            <BlogPostGrid articles={results} />
          )}

          {!isSearching && (
            <>
              <BlogPostGrid articles={articles} />
              <BlogPagination
                basePath={basePath}
                page={page}
                totalPages={totalPages}
              />
            </>
          )}
        </section>
      </Container>
    </Layout>
  )
}
