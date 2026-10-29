import { BlogPostMeta } from '@/components/blog/BlogPostMeta'
import { Article } from '@/utils/types'
import Link from 'next/link'

export interface BlogPostListProps {
  articles: Article[]
}

/** Posts as text rows: title, excerpt, then date, authors, and read time. */
export default function BlogPostList({ articles }: BlogPostListProps) {
  return (
    <ul className="divide-y divide-divider border-y border-divider">
      {articles.map((article) => (
        <li key={article.slug}>
          <Link
            href={`/blog/${article.slug}`}
            className="group grid grid-flow-row gap-2 py-6 hover:no-underline"
          >
            <h3 className="font-mona text-xl text-white group-hover:underline">
              {article.title}
            </h3>
            <p className="text-base text-white text-opacity-65">
              {article.description}
            </p>
            <BlogPostMeta article={article} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
