import { BlogPostMeta } from '@/components/blog/BlogPostMeta'
import { Article } from '@/utils/types'
import Image from 'next/image'
import Link from 'next/link'

export interface BlogPostGridProps {
  articles: Article[]
}

/**
 * Posts as cards: cover, title, excerpt, then date, authors, and read time.
 * One column on phones, two from `sm`, three from `lg`.
 */
export default function BlogPostGrid({ articles }: BlogPostGridProps) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <li key={article.slug}>
          <Link
            href={`/blog/${article.slug}`}
            className="group grid grid-flow-row gap-3 hover:no-underline"
          >
            <div className="overflow-hidden rounded-xl border border-divider">
              <Image
                src={article.image}
                width={1920}
                height={1080}
                alt={`Cover of ${article.title}`}
                className="aspect-video h-auto w-full object-cover motion-safe:transition-transform motion-safe:group-hover:scale-[1.02]"
                sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
              />
            </div>
            <h3 className="font-mona text-lg leading-snug text-white group-hover:underline">
              {article.title}
            </h3>
            <p className="line-clamp-3 text-sm text-white text-opacity-65">
              {article.description}
            </p>
            <BlogPostMeta article={article} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
