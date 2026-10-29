import { BlogLeadPost } from '@/components/blog/BlogLeadPost'
import { BlogPagination, takePageGlide } from '@/components/blog/BlogPagination'
import { BlogPostGrid } from '@/components/blog/BlogPostGrid'
import { BlogSearchField } from '@/components/blog/BlogSearchField'
import { BlogTagRow } from '@/components/blog/BlogTagRow'
import { Container } from '@/components/common/Container'
import { Layout } from '@/components/common/Layout'
import { useArticleSearch } from '@/hooks/useArticleSearch'
import { buildSeo, BuildSeoOptions } from '@/utils/seo'
import { Article } from '@/utils/types'
import { useEffect } from 'react'

/** Id of the posts section, which a page link click glides to. */
const POSTS_ID = 'posts'

export interface BlogListingProps {
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
  /** Every tag, most used first. */
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
 * Searching swaps the page for every match across `searchable`, the lead
 * included, and leaves the lead post above the toolbar in place. Without a
 * search, the prerendered HTML holds this page's posts and links to the
 * neighbouring pages, so crawlers reach every post without JavaScript.
 *
 * Renders its own `Layout` rather than using `getLayout`: `_app.tsx` hands
 * `getLayout` a `PlausibleProvider` element, not the page, so per-page SEO
 * props can't be read there.
 */
export default function BlogListing({
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

  // Every listing page remounts this, so on arriving from a pagination link,
  // glide to the posts while the new cards fade in. Back and forward never set
  // the glide, and page URLs carry no hash, so Next's scroll restoration
  // stands.
  useEffect(() => {
    if (!takePageGlide()) {
      return
    }

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    document.getElementById(POSTS_ID)?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [])

  const count = isSearching ? results.length : totalPosts

  const sectionHeading = activeTag ?? 'Latest'

  return (
    <Layout slotProps={{ nextSeo: buildSeo(seo) }}>
      <Container className="grid max-w-5xl grid-cols-1 gap-10 pb-16 pt-14 lg:pb-28">
        <header className="grid grid-flow-row gap-2">
          <h1 className="font-mona text-3.5xl font-semibold text-white md:text-4.5xl">
            Blog
          </h1>
          <p className="text-base text-white text-opacity-65">
            Read the latest news about Nhost.
          </p>
        </header>

        {lead && <BlogLeadPost article={lead} />}

        {/* Paging glides here, clear of the fixed header. */}
        <section id={POSTS_ID} className="grid scroll-mt-24 grid-cols-1 gap-8">
          <div className="grid grid-cols-1 gap-4 border-b border-divider pb-6">
            <div className="flex items-center gap-3">
              <h2 className="font-mona text-2xl font-semibold text-white">
                {sectionHeading}
              </h2>
              <p
                role="status"
                className="shrink-0 rounded-full border border-divider bg-white bg-opacity-5 px-2 py-0.5 text-xs font-medium tabular-nums text-white text-opacity-65"
              >
                {count}
                <span className="sr-only">
                  {count === 1 ? ' post' : ' posts'}
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <BlogTagRow
                tags={tags}
                activeTag={activeTag}
                query={query}
                className="md:py-0.5"
              />

              <BlogSearchField
                id="blog-search"
                label={
                  activeTag ? `Search ${activeTag} posts` : 'Search the blog'
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
