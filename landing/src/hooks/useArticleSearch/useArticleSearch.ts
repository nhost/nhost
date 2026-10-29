import { Article } from '@/utils/types'
import { useMemo, useState } from 'react'

/** What a post is matched against when searching. */
function searchableText(article: Article): string {
  return [
    article.title,
    article.description,
    ...(article.tags ?? []),
    ...(article.authors ?? []).map((author) => author.name),
  ]
    .join(' ')
    .toLowerCase()
}

/**
 * Filters `articles` by a free-text query and an optional tag, then pages
 * through the result.
 *
 * With neither set, `results` is every article, so a page can list them all
 * through the same paging. The page resets whenever either filter changes.
 *
 * `statusMessage` describes the match count while filtering and is empty
 * otherwise. Render it in an always-mounted `role="status"` element so screen
 * readers announce result changes.
 */
export default function useArticleSearch(articles: Article[], pageSize = 10) {
  const [query, setQueryState] = useState('')
  const [tag, setTagState] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(pageSize)

  const trimmedQuery = query.trim().toLowerCase()
  const isFiltering = trimmedQuery.length > 0 || tag !== null

  // Precompute the haystack once per article list rather than per keystroke.
  const haystacks = useMemo(
    () =>
      new Map(
        articles.map((article) => [article.slug, searchableText(article)]),
      ),
    [articles],
  )

  const results = useMemo(() => {
    if (!isFiltering) return articles

    return articles.filter(
      (article) =>
        (tag === null || (article.tags ?? []).includes(tag)) &&
        (haystacks.get(article.slug) ?? '').includes(trimmedQuery),
    )
  }, [articles, trimmedQuery, tag, isFiltering, haystacks])

  let statusMessage = ''

  if (isFiltering) {
    statusMessage =
      results.length === 0
        ? 'No posts match'
        : `${results.length} ${results.length === 1 ? 'post' : 'posts'}`
  }

  function setQuery(value: string) {
    setQueryState(value)
    setVisibleCount(pageSize)
  }

  function setTag(value: string | null) {
    setTagState(value)
    setVisibleCount(pageSize)
  }

  return {
    query,
    setQuery,
    tag,
    setTag,
    isFiltering,
    results,
    statusMessage,
    visible: results.slice(0, visibleCount),
    hasMore: results.length > visibleCount,
    loadMore: () => setVisibleCount((count) => count + pageSize),
  }
}
