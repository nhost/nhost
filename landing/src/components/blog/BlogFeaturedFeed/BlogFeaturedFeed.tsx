import { BlogPostCard } from '@/components/blog/BlogPostCard'
import { Button } from '@/components/common/Button'
import { Article } from '@/utils/types'
import Image from 'next/image'
import { useState } from 'react'

export interface BlogFeaturedFeedProps {
  /** Posts flagged `featured`, newest first. */
  articles: Article[]
  /**
   * How many posts show before "Load more".
   *
   * @default 3
   */
  initialCount?: number
  /**
   * How many more posts each "Load more" reveals.
   *
   * @default 10
   */
  pageSize?: number
}

export default function BlogFeaturedFeed({
  articles,
  initialCount = 3,
  pageSize = 10,
}: BlogFeaturedFeedProps) {
  const [visibleCount, setVisibleCount] = useState(initialCount)

  const [leadArticle, ...otherArticles] = articles.slice(0, visibleCount)
  const remaining = articles.length - visibleCount

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

      {otherArticles.length > 0 && (
        <div className="grid gap-6 gap-y-16 md:grid-cols-2">
          {otherArticles.map((article) => (
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
          ))}
        </div>
      )}

      {remaining > 0 && (
        <Button
          type="button"
          variant="outlined"
          onClick={() => setVisibleCount((count) => count + pageSize)}
          className="mt-10 justify-self-center"
        >
          Load more
        </Button>
      )}
    </div>
  )
}
