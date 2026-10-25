import { BlogPostGrid } from '@/components/blog/BlogPostGrid'
import { BlogSearchField } from '@/components/blog/BlogSearchField'
import { BlogTagFilter } from '@/components/blog/BlogTagFilter'
import { Button } from '@/components/common/Button'
import { Link } from '@/components/common/Link'
import { useArticleSearch } from '@/hooks/useArticleSearch'
import { groupArticlesByCategory } from '@/lib/blogGrouping'
import { Article } from '@/utils/types'
import { format, parseISO } from 'date-fns'
import { ArrowUpRight } from 'lucide-react'
import { useMemo } from 'react'

export interface BlogDirectoryProps {
  /** Every post, newest first. Includes the featured ones. */
  articles: Article[]
  /** Posts already shown in the featured feed. The category lists skip them. */
  featured?: Article[]
  /** Tags offered as filter buttons under the search field. */
  tags?: string[]
  /**
   * How many post titles each category lists before it defers to its own
   * page.
   *
   * @default 3
   */
  perCategory?: number
  /**
   * How many search results show before "Load more", and how many more each
   * click reveals.
   *
   * @default 10
   */
  pageSize?: number
}

interface ArticleLinkProps {
  article: Article
}

function ArticleLink({ article }: ArticleLinkProps) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group flex items-start py-2.5 hover:no-underline"
    >
      <span className="grid grid-flow-row gap-1">
        <span className="line-clamp-2 text-[15px] leading-snug text-white text-opacity-85 group-hover:text-opacity-100">
          {article.title}
        </span>
        <span className="text-xs text-white text-opacity-50">
          {format(parseISO(article.date), 'd MMM yyyy')}
        </span>
      </span>
    </Link>
  )
}

interface CategoryHeaderProps {
  slug: string
  label: string
  description: string
  /** Posts in the whole category, featured ones included. */
  total: number
}

function CategoryHeader({
  slug,
  label,
  description,
  total,
}: CategoryHeaderProps) {
  const href = `/blog/${slug}`

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3>
          <Link
            href={href}
            className="font-mona text-2xl font-semibold text-white text-opacity-100"
          >
            {label}
          </Link>
        </h3>

        <Link
          href={href}
          aria-label={`All ${total} posts in ${label}`}
          className="shrink-0 gap-1 text-[11px] font-normal uppercase tracking-widest"
        >
          More
          <ArrowUpRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      <p className="mt-1 font-mona text-xs leading-relaxed text-white text-opacity-50">
        {description}
      </p>
    </div>
  )
}

export default function BlogDirectory({
  articles,
  featured = [],
  tags = [],
  perCategory = 3,
  pageSize = 10,
}: BlogDirectoryProps) {
  const {
    query,
    setQuery,
    tag,
    setTag,
    isFiltering,
    results,
    visible,
    hasMore,
    loadMore,
  } = useArticleSearch(articles, pageSize)

  const grouped = useMemo(() => groupArticlesByCategory(articles), [articles])
  const featuredSlugs = useMemo(
    () => new Set(featured.map((article) => article.slug)),
    [featured],
  )

  return (
    <div className="grid grid-flow-row gap-10">
      <div className="grid grid-flow-row gap-5">
        <h2 className="text-center font-mona text-2xl text-white">
          Browse blog
        </h2>

        <BlogSearchField
          id="blog-search"
          label="Search the blog"
          value={query}
          onChange={setQuery}
        />

        <BlogTagFilter tags={tags} selected={tag} onChange={setTag} />
      </div>

      {isFiltering ? (
        <section className="grid grid-flow-row gap-4">
          <h3 className="flex items-center gap-3 font-mona text-2xl font-semibold text-white">
            Search results
            <span className="rounded-full border border-divider px-2.5 py-0.5 font-sans text-xs font-normal tabular-nums text-white text-opacity-65">
              {results.length}
              <span className="sr-only">
                {results.length === 1 ? ' post' : ' posts'}
              </span>
            </span>
          </h3>

          {results.length === 0 ? (
            <p className="border-t border-white border-opacity-30 pt-4 text-sm text-white text-opacity-65">
              No posts match.
            </p>
          ) : (
            <div className="border-t border-white border-opacity-30 pt-8">
              <BlogPostGrid articles={visible} />
            </div>
          )}

          {hasMore && (
            <Button
              type="button"
              variant="outlined"
              onClick={loadMore}
              className="mt-10 justify-self-center"
            >
              Load more
            </Button>
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.map((group) => {
            // The featured feed already shows these, so the list carries the
            // rest. The count still covers the whole category.
            const listed = group.articles
              .filter((article) => !featuredSlugs.has(article.slug))
              .slice(0, perCategory)

            return (
              <section key={group.slug} className="flex flex-col gap-4">
                <CategoryHeader
                  slug={group.slug}
                  label={group.label}
                  description={group.description}
                  total={group.articles.length}
                />

                <ul className="flex flex-col border-t border-white border-opacity-30 pt-2">
                  {listed.map((article) => (
                    <li key={article.slug}>
                      <ArticleLink article={article} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
