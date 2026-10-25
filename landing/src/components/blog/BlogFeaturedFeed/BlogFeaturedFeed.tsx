import { BlogPostCard } from '@/components/blog/BlogPostCard'
import { BlogPostGrid } from '@/components/blog/BlogPostGrid'
import { Article } from '@/utils/types'
import Image from 'next/image'

export interface BlogFeaturedFeedProps {
  /** The featured posts to show, newest first. The first one leads. */
  articles: Article[]
}

export default function BlogFeaturedFeed({ articles }: BlogFeaturedFeedProps) {
  const [leadArticle, ...otherArticles] = articles

  if (!leadArticle) {
    return null
  }

  return (
    <div className="grid grid-flow-row gap-6">
      <BlogPostCard
        image={
          <Image
            src={leadArticle.image}
            width={1920}
            height={1080}
            alt={`Cover of ${leadArticle.title}`}
            blurDataURL={leadArticle.image}
            placeholder="blur"
            className="max-w-full object-cover"
            priority
            quality={100}
          />
        }
        title={leadArticle.title}
        description={leadArticle.description}
        href={`/blog/${leadArticle.slug}`}
        tags={leadArticle.tags}
        authors={leadArticle.authors}
        date={leadArticle.date}
        className="col-span-2 mb-16 max-w-full"
        highlighted
      />

      {otherArticles.length > 0 && <BlogPostGrid articles={otherArticles} />}
    </div>
  )
}
