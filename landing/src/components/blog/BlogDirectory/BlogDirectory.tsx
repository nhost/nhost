import { Button } from '@/components/common/Button'
import { Link } from '@/components/common/Link'
import { groupArticlesByCategory } from '@/lib/blogGrouping'
import { Article } from '@/utils/types'
import { format, parseISO } from 'date-fns'
import { ArrowUpRight } from 'lucide-react'
import Image from 'next/image'
import { ChangeEvent, useMemo, useState } from 'react'

export interface BlogDirectoryProps {
  /** Every post, newest first. Includes the featured ones. */
  articles: Article[]
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

/** What a post is matched against when searching. */
function searchableText(article: Article): string {
  return [
    article.title,
    article.description,
    article.category,
    ...(article.tags ?? []),
    ...(article.authors ?? []).map((author) => author.name),
  ]
    .join(' ')
    .toLowerCase()
}

interface ArticleLinkProps {
  article: Article
  /** Show the cover beside the title. Off in the dense overview columns. */
  thumbnail?: boolean
}

function ArticleLink({ article, thumbnail = false }: ArticleLinkProps) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group flex items-start gap-4 py-2.5 hover:no-underline"
    >
      {thumbnail && (
        <Image
          src={article.image}
          width={160}
          height={90}
          alt=""
          className="aspect-video w-24 shrink-0 rounded-md border border-divider object-cover opacity-85 transition-opacity group-hover:opacity-100"
        />
      )}

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
  const href = `/blog/category/${slug}`

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
          className="shrink-0 gap-1 text-xs font-medium uppercase tracking-widest"
        >
          All {total}
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
  perCategory = 3,
  pageSize = 10,
}: BlogDirectoryProps) {
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(pageSize)

  const trimmedQuery = query.trim().toLowerCase()
  const isSearching = trimmedQuery.length > 0

  // Precompute the haystack once per article list rather than per keystroke.
  const haystacks = useMemo(
    () =>
      new Map(
        articles.map((article) => [article.slug, searchableText(article)]),
      ),
    [articles],
  )

  const matches = useMemo(() => {
    if (!isSearching) return []

    return articles.filter((article) =>
      (haystacks.get(article.slug) ?? '').includes(trimmedQuery),
    )
  }, [articles, trimmedQuery, isSearching, haystacks])

  const grouped = useMemo(() => groupArticlesByCategory(articles), [articles])

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value)
    setVisibleCount(pageSize)
  }

  return (
    <div className="grid grid-flow-row gap-10">
      <div className="grid grid-flow-row gap-5">
        <h2 className="text-center font-mona text-2xl text-white">
          Browse blogs
        </h2>

        <div className="mx-auto w-full max-w-md">
          <label className="sr-only" htmlFor="blog-search">
            Search the blog
          </label>

          <input
            id="blog-search"
            type="search"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search posts, topics, or authors"
            autoComplete="off"
            className="w-full rounded-xl border border-white border-opacity-25 bg-transparent px-4 py-3 text-base text-white placeholder:text-white placeholder:text-opacity-40 focus:border-opacity-60 focus:outline-none"
          />
        </div>
      </div>

      {isSearching ? (
        <section className="grid grid-flow-row gap-4">
          <h3 className="font-mona text-2xl font-semibold text-white">
            Search results
          </h3>

          {matches.length === 0 ? (
            <p className="border-t border-white border-opacity-30 pt-4 text-sm text-white text-opacity-65">
              No posts match.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-x-10 border-t border-white border-opacity-30 pt-2 sm:grid-cols-2 lg:grid-cols-3">
              {matches.slice(0, visibleCount).map((article) => (
                <li key={article.slug}>
                  <ArticleLink article={article} thumbnail />
                </li>
              ))}
            </ul>
          )}

          {matches.length > visibleCount && (
            <Button
              type="button"
              variant="outlined"
              onClick={() => setVisibleCount((count) => count + pageSize)}
              className="mt-6 justify-self-center"
            >
              Load more
            </Button>
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.map((group) => {
            // Featured posts already lead the page, so the list carries the
            // rest. The count still covers the whole category.
            const listed = group.articles
              .filter((article) => !article.featured)
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
