import { Article } from '@/utils/types'
import { format, parseISO } from 'date-fns'
import Image from 'next/image'

export interface BlogPostMetaProps {
  article: Article
  /** Put the authors' avatars before their names. */
  avatars?: boolean
}

/** "Ada Lovelace · 12 Mar 2026 · 6 min read" */
export default function BlogPostMeta({
  article,
  avatars = false,
}: BlogPostMetaProps) {
  const date = format(parseISO(article.date), 'd MMM yyyy')
  const readingTime = `${article.readingMinutes} min read`

  if (!avatars || article.authors.length === 0) {
    const parts = [
      article.authors.map((author) => author.name).join(', '),
      date,
      readingTime,
    ].filter(Boolean)

    return (
      <p className="text-sm text-white text-opacity-50">{parts.join(' · ')}</p>
    )
  }

  // The names follow the avatars, so the images are decorative.
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white text-opacity-50">
      <span className="flex -space-x-1.5">
        {article.authors.map((author) => (
          <Image
            key={author.name}
            src={author.avatarUrl}
            width={40}
            height={40}
            alt=""
            className="h-5 w-5 rounded-full object-cover ring-2 ring-default"
          />
        ))}
      </span>
      <span>{article.authors.map((author) => author.name).join(', ')}</span>
      <span>·</span>
      <span>{date}</span>
      <span>·</span>
      <span>{readingTime}</span>
    </p>
  )
}
