import { Container } from '@/components/Container'
import { Content } from '@/components/Content'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import components from '@/components/MDX/components'
import { Nav } from '@/components/Nav'
import { NavigationProvider } from '@/components/NavigationContext'
import { createConvolutedNav } from '@/lib/post'
import { capitalize } from '@/utils/capitalize'
import fs from 'fs'
import matter from 'gray-matter'
import { serialize } from 'next-mdx-remote/serialize'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { join } from 'path'
import React from 'react'

import { Main } from '../components/Main'

export default function Home({
  category,
  frontmatter,
  mdxSource,
  convolutedNav,
  availableMenus,
  categoryTitle
}) {
  const router = useRouter()
  const pathname = `/${router.query.category}`

  return (
    <NavigationProvider
      query={router.query}
      category={category}
      categoryTitle={categoryTitle}
      convolutedNav={convolutedNav}
      availableNavMenus={availableMenus}
      pathname={router.pathname}
    >
      <div className="bg-white pt-2">
        <Head>
          <title>
            {frontmatter.title} - {capitalize(category)} | Nhost Documentation
          </title>
        </Head>
        <Header />
        <Container>
          <Nav
            className="hidden lg:flex"
            categoryTitle={categoryTitle}
            convolutedNav={convolutedNav}
            category={category}
            query={router.query}
          />
          <Main>
            <Content mdxSource={mdxSource} components={components} frontmatter={frontmatter} />
          </Main>
        </Container>
        <Footer />
      </div>
    </NavigationProvider>
  )
}

export async function getStaticProps({ params }) {
  const postsDirectory = join(process.cwd(), 'content', 'docs')
  const availableCategories = fs.readdirSync(postsDirectory)
  const convolutedNavs = availableCategories.map((category) => ({
    name: category,
    items: createConvolutedNav(category)
  }))

  const convolutedNav =
    convolutedNavs.find((nav) => nav.name === params.category).items ||
    createConvolutedNav(params.category)

  const categoryTitle = matter(
    fs.readFileSync(join(postsDirectory, `${params.category}/index.mdx`), 'utf8')
  ).data.title

  const fullPath = join(postsDirectory, `${params.category}/index.mdx`)
  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)
  const mdxSource = await serialize(content)

  return {
    props: {
      categoryTitle,
      category: params.category,
      frontmatter: { ...data },
      mdxSource,
      availableMenus: convolutedNavs,
      convolutedNav
    }
  }
}

export async function getStaticPaths(props) {
  const postsDirectory = join(process.cwd(), 'content', 'docs')
  let paths = []
  fs.readdirSync(postsDirectory).forEach((file) => {
    let absolute = join(postsDirectory, file)

    if (fs.statSync(absolute).isDirectory()) {
      paths.push(file)
    }
  })

  return {
    paths: paths.map((category) => {
      return {
        params: {
          availableCategories: paths,
          category
        }
      }
    }),
    fallback: false
  }
}
