import { BlogLeadPost } from '@/components/blog/BlogLeadPost'
import { BlogPostGrid } from '@/components/blog/BlogPostGrid'
import { BlogSearchField } from '@/components/blog/BlogSearchField'
import { BlogTagRow } from '@/components/blog/BlogTagRow'
import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Layout } from '@/components/common/Layout'
import { useArticleSearch } from '@/hooks/useArticleSearch'
import { POSTS_PER_BATCH } from '@/lib/blogGrouping'
import { buildSeo, BuildSeoOptions } from '@/utils/seo'
import { Article } from '@/utils/types'
import Router from 'next/router'
import { useEffect, useRef, useState } from 'react'

/**
 * How many posts each listing has revealed, by path, so moving between tags
 * and reading a post keep each list as far open as it was. Lives until a full
 * reload or a navigation outside /blog.
 */
const revealedCounts = new Map<string, number>()

/** The same for search results, for one search term only. */
const revealedSearch = { term: '', counts: new Map<string, number>() }

/** Forgets the revealed search results unless they were for `term`. */
function keepRevealedSearch(term: string) {
  if (revealedSearch.term !== term) {
    revealedSearch.term = term
    revealedSearch.counts.clear()
  }
}

if (typeof window !== 'undefined') {
  Router.events.on('routeChangeStart', (url: string) => {
    if (!/^\/blog(?=[/?#]|$)/.test(url)) {
      revealedCounts.clear()
      keepRevealedSearch('')
    }
  })
}

export interface BlogListingProps {
  seo: BuildSeoOptions
  /** Shown above the toolbar on every listing; the lists leave it out. */
  lead: Article | null
  /** Every post in the listing, newest first. */
  articles: Article[]
  /** Every post the search covers: the listing plus the lead. */
  searchable: Article[]
  /** Every tag, most used first. */
  tags: string[]
  /** The tag whose listing this is, or `null` on /blog. */
  activeTag: string | null
}

/**
 * The blog's listing pages: an optional lead post, a toolbar with search and
 * tags, then the newest posts with a button that shows more.
 *
 * Searching swaps the list for the matches across `searchable`, the lead
 * included, shown in the same batches, and leaves the lead post above the
 * toolbar in place. Without a search, the prerendered HTML links every post in
 * the listing, with the ones not shown yet hidden, so crawlers reach them all
 * without JavaScript.
 *
 * Renders its own `Layout` rather than using `getLayout`: `_app.tsx` hands
 * `getLayout` a `PlausibleProvider` element, not the page, so per-page SEO
 * props can't be read there.
 */
export default function BlogListing({
  seo,
  lead,
  articles,
  searchable,
  tags,
  activeTag,
}: BlogListingProps) {
  const { query, setQuery, isSearching, results } = useArticleSearch(searchable)

  const [listCount, setListCount] = useState(
    () => revealedCounts.get(seo.path) ?? POSTS_PER_BATCH,
  )
  const searchTerm = query.trim().toLowerCase()
  const [searchCount, setSearchCount] = useState(() =>
    revealedSearch.term === searchTerm
      ? revealedSearch.counts.get(seo.path) ?? POSTS_PER_BATCH
      : POSTS_PER_BATCH,
  )
  const visibleCount = isSearching ? searchCount : listCount
  const postsRef = useRef<HTMLDivElement>(null)
  const showedMoreRef = useRef(false)

  // Move focus to the first post a "Show more posts" click revealed, so
  // keyboard users continue from there rather than below the new posts.
  useEffect(() => {
    if (!showedMoreRef.current) {
      return
    }

    showedMoreRef.current = false
    postsRef.current
      ?.querySelectorAll<HTMLAnchorElement>('li > a')
      [visibleCount - POSTS_PER_BATCH]?.focus({ preventScroll: true })
  }, [visibleCount])

  function handleShowMore() {
    showedMoreRef.current = true

    if (isSearching) {
      keepRevealedSearch(searchTerm)
      revealedSearch.counts.set(seo.path, searchCount + POSTS_PER_BATCH)
      setSearchCount(searchCount + POSTS_PER_BATCH)

      return
    }

    revealedCounts.set(seo.path, listCount + POSTS_PER_BATCH)
    setListCount(listCount + POSTS_PER_BATCH)
  }

  // Each new search term starts again from the first batch, on every listing.
  function handleQueryChange(value: string) {
    const term = value.trim().toLowerCase()

    setQuery(value)

    if (term !== searchTerm) {
      keepRevealedSearch(term)
      setSearchCount(POSTS_PER_BATCH)
    }
  }

  const shown = isSearching ? results : articles
  const count = shown.length

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

        <section className="grid grid-cols-1 gap-8">
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
                onChange={handleQueryChange}
                className="md:max-w-[16rem] md:shrink-0"
              />
            </div>
          </div>

          {isSearching && results.length === 0 && (
            <p className="text-sm text-white text-opacity-65">
              No posts match.
            </p>
          )}

          {shown.length > 0 && (
            <div ref={postsRef} className="grid grid-cols-1 gap-12">
              <BlogPostGrid articles={shown} visibleCount={visibleCount} />

              {visibleCount < shown.length && (
                <div className="flex items-center gap-4">
                  <span aria-hidden className="h-px flex-1 bg-divider" />
                  <Button
                    type="button"
                    variant="outlined"
                    size="sm"
                    onClick={handleShowMore}
                    className="shrink-0"
                  >
                    Show more posts
                  </Button>
                  <span aria-hidden className="h-px flex-1 bg-divider" />
                  <p className="shrink-0 text-xs tabular-nums text-white text-opacity-50">
                    {shown.length - visibleCount} left
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </Container>
    </Layout>
  )
}
