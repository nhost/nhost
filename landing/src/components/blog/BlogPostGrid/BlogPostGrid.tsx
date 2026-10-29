import { BlogPostMeta } from '@/components/blog/BlogPostMeta'
import { POSTS_PER_BATCH } from '@/lib/blogGrouping'
import { Article } from '@/utils/types'
import Image from 'next/image'
import Link from 'next/link'

export interface BlogPostGridProps {
  articles: Article[]
  /** How many of `articles` to show; the rest render hidden. Default all. */
  visibleCount?: number
}

/** Later cards in a batch wait a little longer to fade in, up to this many steps. */
const MAX_STAGGER_STEPS = 6

/**
 * Posts as cards: cover, title, excerpt, then date, authors, and read time.
 * One column on phones, two from `sm`, three from `lg`.
 *
 * Cards fade in when they mount or are unhidden, staggered within each batch
 * of `POSTS_PER_BATCH`. They are keyed by slug, so as a search changes only
 * newly matching cards animate.
 */
export default function BlogPostGrid({
  articles,
  visibleCount = articles.length,
}: BlogPostGridProps) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article, index) => (
        <li
          key={article.slug}
          hidden={index >= visibleCount}
          className="motion-safe:animate-card-in"
          style={{
            animationDelay: `${
              Math.min(index % POSTS_PER_BATCH, MAX_STAGGER_STEPS) * 40
            }ms`,
          }}
        >
          <Link
            href={`/blog/${article.slug}`}
            className="group grid grid-flow-row gap-3 hover:no-underline"
          >
            <div className="overflow-hidden rounded-xl border border-divider bg-paper">
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
