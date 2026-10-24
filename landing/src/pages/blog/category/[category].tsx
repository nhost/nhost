import { BlogPostCard } from '@/components/blog/BlogPostCard'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { Link } from '@/components/common/Link'
import { SectionHeading } from '@/components/common/SectionHeading'
import { blogCategories, getBlogCategory } from '@/data/blogCategories'
import { getAllArticles } from '@/lib/blog'
import { buildSeo } from '@/utils/seo'
import { Article } from '@/utils/types'
import { GetStaticPaths, GetStaticProps } from 'next'
import Image from 'next/image'

export interface BlogCategoryPageProps {
  label: string
  description: string
  articles: Article[]
  seo: {
    path: string
    title: string
    description: string
  }
}

/**
 * Renders its own `Layout` rather than using the `getLayout` convention the
 * other pages follow. `_app.tsx` hands `getLayout` a `PlausibleProvider`
 * element, not the page, so there is no way to read per-category props there,
 * and `Layout` always renders one `<NextSeo />`. Doing it here keeps the SEO
 * tags correct for each category without emitting them twice.
 */
export default function BlogCategoryPage({
  label,
  description,
  articles,
  seo,
}: BlogCategoryPageProps) {
  return (
    <Layout slotProps={{ nextSeo: buildSeo(seo) }}>
      <Container
        component="section"
        className="relative flex max-w-5xl py-20 lg:py-28"
      >
        <LineGrid
          className="top-5 left-0 right-0 mx-auto h-32 w-32 translate-x-0 scale-100 lg:top-16 lg:h-40 lg:w-40"
          slotProps={{ image: { className: 'mx-auto' } }}
          priority
        />
        <Glow className="top-5 h-32 w-32 bg-opacity-50 blur-3xl lg:top-16" />
        <SectionHeading
          title={label}
          subtitle={description}
          slotProps={{
            title: {
              component: 'h1',
              className: 'text-3.5xl md:text-5xl',
            },
          }}
          className="relative z-10"
        />
      </Container>

      <Container
        component="section"
        className="grid max-w-5xl grid-flow-row gap-10 pb-16 lg:pb-28"
      >
        <Link href="/blog">Back to all posts</Link>

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
      </Container>
    </Layout>
  )
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: blogCategories.map((category) => ({
    params: { category: category.slug },
  })),
  fallback: false,
})

export const getStaticProps: GetStaticProps<BlogCategoryPageProps> = async ({
  params,
}) => {
  const slug = String(params?.category)
  const category = getBlogCategory(slug)

  if (!category) {
    return { notFound: true }
  }

  const articles = (await getAllArticles()).filter(
    (article) => article.category === slug,
  )

  return {
    props: {
      label: category.label,
      description: category.description,
      articles,
      seo: {
        path: `/blog/category/${slug}`,
        // `_app.tsx` appends "| Nhost" via titleTemplate, so no suffix here.
        title: `${category.label} on the Nhost blog`,
        description: category.description,
      },
    },
  }
}
