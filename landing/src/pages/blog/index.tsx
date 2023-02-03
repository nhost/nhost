import { BlogPostCard } from '@/components/blog/BlogPostCard'
import { Container } from '@/components/common/Container'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import { Article } from '@/utils/types'
import glob from 'fast-glob'
import Image from 'next/image'
import * as path from 'path'
import { ReactElement } from 'react'

export interface BlogPageProps {
  articles: Article[]
}

export default function BlogPage({ articles }: BlogPageProps) {
  const [firstArticle, ...otherArticles] = articles

  return (
    <>
      <Container
        component="section"
        className="relative flex max-w-5xl pt-8 pb-16 lg:pt-28 lg:pb-28"
      >
        <LineGrid
          className="-top-5 left-0 right-0 mx-auto h-32 w-32 translate-x-0 scale-100 lg:top-5 lg:h-40 lg:w-40"
          slotProps={{ image: { className: 'mx-auto' } }}
        />
        <div className="absolute left-0 right-0 z-0 mx-auto h-20 w-20 rounded-full bg-brand-main blur-[56px] lg:top-24"></div>
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

      <Container
        component="section"
        className="grid max-w-5xl grid-flow-row gap-6 pb-16 lg:pb-28"
      >
        <BlogPostCard
          image={
            <Image
              src={`/images/blog/${firstArticle.image}`}
              width={1920}
              height={1080}
              alt={`Cover of ${firstArticle.title}`}
              blurDataURL={`/images/blog/${firstArticle.image}`}
              placeholder="blur"
              className="object-cover"
              priority
            />
          }
          title={firstArticle.title}
          description={firstArticle.description}
          href={`/blog/${firstArticle.slug}`}
          tags={firstArticle.tags}
          authors={firstArticle.authors}
          date={firstArticle.date}
          className="col-span-2"
          highlighted
        />

        <div className="grid gap-6 md:grid-cols-2">
          {otherArticles.map((article) => (
            <BlogPostCard
              key={article.slug}
              image={
                <Image
                  src={`/images/blog/${article.image}`}
                  width={400}
                  height={225}
                  alt={`Cover of ${article.title}`}
                  blurDataURL={`/images/blog/${article.image}`}
                  placeholder="blur"
                  className="h-full w-full object-contain"
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
    </>
  )
}

BlogPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}

export async function getStaticProps() {
  // TODO: Move this function to a separate file
  const importArticle = async (articleFilename: any) => {
    // if we change the location of this folder, make sure the path is correct!
    let { article, default: component } = await import(`./${articleFilename}`)
    return {
      slug: articleFilename.replace(/(\/index)?\.mdx$/, ''),
      ...article,
      component,
    }
  }

  // TODO: move this function to a separate file
  const getAllArticles = async () => {
    const articleFilenames = await glob(['*.mdx', '*/index.mdx'], {
      cwd: path.join(process.cwd(), 'src/pages/blog'),
    })

    const articles = await Promise.all(articleFilenames.map(importArticle))

    return articles.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
  }

  return {
    props: {
      articles: (await getAllArticles()).map(
        ({ component, ...article }) => article,
      ),
    },
  }
}
