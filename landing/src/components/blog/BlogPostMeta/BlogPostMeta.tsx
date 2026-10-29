import { Article } from '@/utils/types'
import { format, parseISO } from 'date-fns'

export interface BlogPostMetaProps {
  article: Article
}

/** "12 Mar 2026 · Ada Lovelace · 6 min read" */
export default function BlogPostMeta({ article }: BlogPostMetaProps) {
  const parts = [
    format(parseISO(article.date), 'd MMM yyyy'),
    article.authors.map((author) => author.name).join(', '),
    `${article.readingMinutes} min read`,
  ].filter(Boolean)

  return (
    <p className="text-sm text-white text-opacity-50">{parts.join(' · ')}</p>
  )
}
