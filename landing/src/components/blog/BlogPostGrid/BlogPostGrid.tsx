import { BlogPostCard } from '@/components/blog/BlogPostCard'
import { Article } from '@/utils/types'
import Image from 'next/image'

export interface BlogPostGridProps {
  articles: Article[]
}

/** Posts as cards, two per row from `md` up. */
export default function BlogPostGrid({ articles }: BlogPostGridProps) {
  return (
    <div className="grid gap-6 gap-y-16 md:grid-cols-2">
      {articles.map((article) => (
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
  )
}
