import { Article } from '@/utils/types'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'

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
 * Filters `articles` by a free-text query kept in the URL as `?q=`, so a search
 * can be shared as a link.
 *
 * `results` is every matching article, newest first, and is only meaningful
 * while `isSearching`.
 *
 * `statusMessage` describes the match count while searching and is empty
 * otherwise. Render it in an always-mounted `role="status"` element so screen
 * readers announce result changes.
 */
export default function useArticleSearch(articles: Article[]) {
  const router = useRouter()
  const [query, setQueryState] = useState('')
  const readFromUrl = useRef(false)

  // Static pages render without the query string, so `?q=` is only known once
  // the router is ready. Read it then, once; after that the input owns it.
  useEffect(() => {
    if (!router.isReady || readFromUrl.current) return

    readFromUrl.current = true

    if (typeof router.query.q === 'string') {
      setQueryState(router.query.q)
    }
  }, [router.isReady, router.query.q])

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

  const results = useMemo(
    () =>
      isSearching
        ? articles.filter((article) =>
            (haystacks.get(article.slug) ?? '').includes(trimmedQuery),
          )
        : [],
    [articles, trimmedQuery, isSearching, haystacks],
  )

  let statusMessage = ''

  if (isSearching) {
    statusMessage =
      results.length === 0
        ? 'No posts match'
        : `${results.length} ${results.length === 1 ? 'post' : 'posts'}`
  }

  function setQuery(value: string) {
    setQueryState(value)

    const nextQuery = { ...router.query }

    if (value.trim()) {
      nextQuery.q = value
    } else {
      delete nextQuery.q
    }

    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
      shallow: true,
      scroll: false,
    })
  }

  return { query, setQuery, isSearching, results, statusMessage }
}
