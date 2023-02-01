import Image from 'next/image'
import { ReactElement } from 'react'
import { Layout } from '@/components/Layout'
import glob from 'fast-glob'
import Link from 'next/link'
import * as path from 'path'

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
  slug: string
}

interface PageProps {
  articles: Article[]
}

export default function Page({ articles }: PageProps) {
  console.log(articles)

  return (
    <div>
      {articles.map((article) => {
        return (
          <div key={article.slug}>
            <div>
              {article.image && (
                <Image
                  src={`/images/blog/og-dark-mode.png`}
                  width={800}
                  height={450}
                  alt=""
                  blurDataURL={`/images/blog/${article.image}`}
                  placeholder="blur"
                />
              )}
            </div>
            <h2>{article.title}</h2>
            <div>{article.description}</div>
            <div>{article.date}</div>
            <div>Authors: {article.authors.map((author) => author.name)}</div>
            <div>
              <Link href={`/blog/${article.slug}`}>Read more</Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

Page.getLayout = function getLayout(page: ReactElement) {
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
