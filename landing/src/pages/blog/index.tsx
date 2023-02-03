import { Container } from '@/components/common/Container'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import { format, parseISO } from 'date-fns'
import glob from 'fast-glob'
import Image from 'next/image'
import Link from 'next/link'
import * as path from 'path'
import { ReactElement } from 'react'

interface Author {
  name: string
  title: string
  avatarUrl: string
  url: string
}

interface Article {
  title: string
  description: string
  image: string
  date: string
  authors: Author[]
  tags: string[]
  slug: string
}

interface BlogPageProps {
  articles: Article[]
}

export default function BlogPage({ articles }: BlogPageProps) {
  console.log(articles)

  const firstArticle = articles[0]
  console.log(firstArticle)

  // get all other articles except the first one
  const otherArticles = articles.slice(1)
  console.log(otherArticles)

  return (
    <>
      <Container component="section" className="relative py-28">
        <LineGrid
          className="top-5 left-0 right-0 mx-auto h-40 w-40 translate-x-0 scale-100"
          slotProps={{ image: { className: 'mx-auto' } }}
        />
        <div className="absolute top-24 left-0 right-0 z-0 mx-auto h-20 w-20 rounded-full bg-brand-main blur-[56px]"></div>
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

      <div>
        <Image
          src={`/images/blog/og-dark-mode.png`}
          width={800}
          height={450}
          alt=""
          blurDataURL={`/images/blog/${firstArticle.image}`}
          placeholder="blur"
        />
        <div>
          {firstArticle.tags.map((tag) => {
            return <span key={tag}>{tag}</span>
          })}
        </div>
        <Link href={`/blog/${firstArticle.slug}`}>{firstArticle.title}</Link>
        <div>{firstArticle.description}</div>
        <div>
          <div>
            {firstArticle.authors.map((author) => {
              return (
                <img
                  key={author.avatarUrl}
                  src={`${author.avatarUrl}`}
                  width={50}
                  height={50}
                  alt={author.name}
                />
              )
            })}
          </div>
          <div>{format(parseISO(firstArticle.date), 'd MMMM yyyy')}</div>
        </div>
      </div>

      <div className="grid grid-cols-2">
        {otherArticles.map((article) => {
          return (
            <div key={article.slug}>
              <Image
                src={`/images/blog/${article.image}`}
                width={400}
                height={225}
                alt=""
                blurDataURL={`/images/blog/${article.image}`}
                placeholder="blur"
              />
              <div>
                {article.tags.map((tag) => {
                  return <span key={tag}>{tag}</span>
                })}
              </div>
              <Link href={`/blog/${article.slug}`}>{article.title}</Link>
              <div>{article.description}</div>
              <div>
                <div>
                  {article.authors.map((author) => {
                    return (
                      <img
                        key={author.avatarUrl}
                        src={`${author.avatarUrl}`}
                        width={50}
                        height={50}
                        alt={author.name}
                      />
                    )
                  })}
                </div>
                <div>{format(parseISO(article.date), 'd MMMM yyyy')}</div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

BlogPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}

// SSR
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
    let articleFilenames = await glob(['*.mdx', '*/index.mdx'], {
      cwd: path.join(process.cwd(), 'src/pages/blog'),
    })

    let articles = await Promise.all(articleFilenames.map(importArticle))

    console.log(articles)

    return articles

    // TODO: fix this sort
    // return articles.sort((a: any, z: any) => {
    //   return !!(new Date(z.date) > new Date(a.date));
    // }
  }

  return {
    props: {
      articles: (await getAllArticles()).map(
        ({ component, ...article }) => article,
      ),
    },
  }
}
