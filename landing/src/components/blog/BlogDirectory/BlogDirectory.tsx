import { BlogPostCard } from '@/components/blog/BlogPostCard'
import { Link } from '@/components/common/Link'
import { blogCategories } from '@/data/blogCategories'
import { groupArticlesByCategory } from '@/lib/blogGrouping'
import { Article } from '@/utils/types'
import Image from 'next/image'
import { ChangeEvent, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export interface BlogDirectoryProps {
  /** Every post, newest first. Includes the featured ones. */
  articles: Article[]
  /**
   * How many posts each category shows before it defers to its own page.
   * Keeps the index short on a phone.
   */
  perCategory?: number
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

function ArticleCard({ article }: { article: Article }) {
  return (
    <BlogPostCard
      key={article.slug}
      image={
        <Image
          src={article.image}
          width={400}
          height={225}
          alt={`Cover of ${article.title}`}
          className="h-full w-full object-contain"
          quality={90}
        />
      }
      title={article.title}
      description={article.description}
      href={`/blog/${article.slug}`}
      tags={article.tags}
      authors={article.authors}
      date={article.date}
    />
  )
}

export default function BlogDirectory({
  articles,
  perCategory = 4,
}: BlogDirectoryProps) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const trimmedQuery = query.trim().toLowerCase()
  const isFiltering = trimmedQuery.length > 0 || activeCategory !== 'all'

  // Precompute the haystack once per article list rather than per keystroke.
  const haystacks = useMemo(
    () => new Map(articles.map((article) => [article.slug, searchableText(article)])),
    [articles],
  )

  const matches = useMemo(() => {
    if (!isFiltering) return []

    return articles.filter((article) => {
      if (activeCategory !== 'all' && article.category !== activeCategory) {
        return false
      }

      if (!trimmedQuery) return true

      return (haystacks.get(article.slug) ?? '').includes(trimmedQuery)
    })
  }, [articles, activeCategory, trimmedQuery, isFiltering, haystacks])

  // Featured posts lead the page, so the sections below carry the rest.
  const grouped = useMemo(
    () => groupArticlesByCategory(articles.filter((article) => !article.featured)),
    [articles],
  )

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const article of articles) {
      counts.set(article.category, (counts.get(article.category) ?? 0) + 1)
    }
    return counts
  }, [articles])

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value)
  }

  return (
    <div className="grid grid-flow-row gap-10">
      <div className="grid grid-flow-row gap-5">
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
          className="w-full rounded-xl border border-divider bg-transparent px-4 py-3 text-base text-white placeholder:text-white placeholder:text-opacity-40 focus:border-white focus:border-opacity-30 focus:outline-none"
        />

        <div className="flex flex-wrap gap-2">
          {[{ slug: 'all', label: 'All' }, ...blogCategories].map(
            (category) => {
              const active = activeCategory === category.slug
              const count =
                category.slug === 'all'
                  ? articles.length
                  : (categoryCounts.get(category.slug) ?? 0)

              return (
                <button
                  key={category.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveCategory(category.slug)}
                  className={twMerge(
                    'rounded-full border px-4 py-1.5 text-sm transition-colors',
                    active
                      ? 'border-white border-opacity-40 text-white'
                      : 'border-divider text-white text-opacity-65 hover:text-opacity-100',
                  )}
                >
                  {category.label}
                  <span className="ml-2 text-white text-opacity-40">
                    {count}
                  </span>
                </button>
              )
            },
          )}
        </div>
      </div>

      {isFiltering ? (
        <div className="grid grid-flow-row gap-8">
          <p className="text-sm text-white text-opacity-65">
            {matches.length === 0
              ? 'No posts match that search.'
              : `${matches.length} ${matches.length === 1 ? 'post' : 'posts'}`}
          </p>

          {matches.length > 0 && (
            <div className="grid gap-6 gap-y-16 md:grid-cols-2">
              {matches.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-flow-row gap-20">
          {grouped.map((group) => {
            const total = categoryCounts.get(group.slug) ?? group.articles.length
            const shown = group.articles.slice(0, perCategory)

            return (
              <section key={group.slug} className="grid grid-flow-row gap-8">
                <div className="grid grid-flow-row gap-2">
                  <h2 className="font-mona text-2xl text-white">
                    {group.label}
                  </h2>
                  <p className="text-base text-white text-opacity-65">
                    {group.description}
                  </p>
                </div>

                <div className="grid gap-6 gap-y-16 md:grid-cols-2">
                  {shown.map((article) => (
                    <ArticleCard key={article.slug} article={article} />
                  ))}
                </div>

                {total > shown.length && (
                  <Link href={`/blog/category/${group.slug}`}>
                    All {total} in {group.label.toLowerCase()}
                  </Link>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
