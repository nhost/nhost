import { BlogPostMeta } from '@/components/blog/BlogPostMeta'
import { Article } from '@/utils/types'
import Image from 'next/image'
import Link from 'next/link'

export interface BlogLeadPostProps {
  article: Article
}

/** The post leading /blog: cover on the left, text on the right from `md` up. */
export default function BlogLeadPost({ article }: BlogLeadPostProps) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group grid items-center gap-6 hover:no-underline md:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] md:gap-10"
    >
      <div className="overflow-hidden rounded-xl border border-divider">
        <Image
          src={article.image}
          width={1920}
          height={1080}
          alt={`Cover of ${article.title}`}
          blurDataURL={article.image}
          placeholder="blur"
          className="h-auto w-full object-cover"
          sizes="(min-width: 1024px) 560px, 100vw"
          priority
        />
      </div>

      <div className="grid grid-flow-row gap-3">
        {article.tags.length > 0 && (
          <p className="text-sm text-white text-opacity-65">
            {article.tags.join(' · ')}
          </p>
        )}
        <h2 className="font-mona text-2xl font-semibold text-white group-hover:underline md:text-3xl">
          {article.title}
        </h2>
        <p className="text-base text-white text-opacity-65">
          {article.description}
        </p>
        <BlogPostMeta article={article} avatars />
      </div>
    </Link>
  )
}
