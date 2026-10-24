import { BlogDirectory } from '@/components/blog/BlogDirectory'
import { BlogFeaturedFeed } from '@/components/blog/BlogFeaturedFeed'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import { getAllArticles } from '@/lib/blog'
import { getFeaturedArticles } from '@/lib/blogGrouping'
import { buildSeo } from '@/utils/seo'
import { Article } from '@/utils/types'
import { ReactElement } from 'react'

export interface BlogPageProps {
  /** Every post, newest first. */
  articles: Article[]
  /** Posts flagged `featured`, newest first. */
  featured: Article[]
}

export default function BlogPage({ articles, featured }: BlogPageProps) {
  return (
    <>
      <Container
        component="section"
        className="relative flex max-w-5xl py-20 lg:py-28"
      >
        <LineGrid
          className="left-0 right-0 top-5 mx-auto h-32 w-32 translate-x-0 scale-100 lg:top-16 lg:h-40 lg:w-40"
          slotProps={{ image: { className: 'mx-auto' } }}
          priority
        />
        <Glow className="top-5 h-32 w-32 bg-opacity-50 blur-3xl lg:top-16" />
        <SectionHeading
          title="Blog"
          subtitle="Read the latest news about Nhost."
          slotProps={{
            title: {
              component: 'h1',
              className: 'text-3.5xl md:text-5xl',
            },
          }}
          className="relative z-10"
        />
      </Container>

      <Container component="section" className="max-w-5xl pb-16 lg:pb-24">
        <BlogFeaturedFeed articles={featured} />
      </Container>

      <Container component="section" className="max-w-5xl pb-16 lg:pb-28">
        <BlogDirectory articles={articles} />
      </Container>
    </>
  )
}

BlogPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout
      slotProps={{
        nextSeo: buildSeo({
          path: '/blog',
          title: 'Blog: Product News and Dev Guides',
          description:
            'The latest Nhost news, product updates, engineering deep-dives, and developer guides on Postgres, GraphQL, Auth, and more.',
        }),
      }}
    >
      {page}
    </Layout>
  )
}

export async function getStaticProps() {
  const articles = await getAllArticles()

  return {
    props: {
      articles,
      featured: getFeaturedArticles(articles),
    },
  }
}
