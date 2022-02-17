import { Container } from '@/components/Container'
import { Content } from '@/components/Content'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import components from '@/components/MDX/components'
import { Nav } from '@/components/Nav'
import { NavigationProvider } from '@/components/NavigationContext'
import { SubNavigation } from '@/components/SubNavigation'
import { TopNavigation } from '@/components/TopNavigation'
import { createConvolutedNav, getAllPosts, removeIndexFile } from '@/lib/post'
import { capitalize } from '@/utils/capitalize'
import fs from 'fs'
import matter from 'gray-matter'
import { serialize } from 'next-mdx-remote/serialize'
import { useRouter } from 'next/dist/client/router'
import Head from 'next/head'
import { join } from 'path'
import React from 'react'

import { Main } from '../../../components/Main'

export default function Post({
  category,
  subcategory,
  frontmatter,
  mdxSource,
  convolutedNav,
  availableMenus,
  post,
  categoryTitle
}) {
  const router = useRouter()

  return (
    <NavigationProvider
      query={router.query}
      category={category}
      categoryTitle={categoryTitle}
      convolutedNav={convolutedNav}
      availableNavMenus={availableMenus}
    >
      <div className="bg-white pt-2">
        <Head>
          <title>
            {frontmatter.title} - {capitalize(subcategory)} - {capitalize(category)} | Nhost
            Documentation
          </title>
        </Head>
        <Header />
        <Container>
          <Nav
            className="hidden lg:flex"
            convolutedNav={convolutedNav}
            category={category}
            categoryTitle={categoryTitle}
            query={router.query}
          />

          <Main>
            <TopNavigation category={category} subcategory={subcategory} />

            <Content mdxSource={mdxSource} components={components} frontmatter={frontmatter} />

            <SubNavigation
              convolutedNav={convolutedNav}
              category={category}
              post={post}
              subcategory={subcategory}
            />
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

  const fullPath = join(
    postsDirectory,
    `${params.category}/${params.subcategory}/${params.post}.mdx`
  )
  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)
  const mdxSource = await serialize(content)

  return {
    props: {
      category: params.category,
      categoryTitle,
      subcategory: params.subcategory,
      post: params.post,
      frontmatter: { ...data },
      mdxSource,
      availableMenus: convolutedNavs,
      convolutedNav
    }
  }
}

export async function getStaticPaths() {
  const { posts } = getAllPosts()

  return {
    paths: removeIndexFile(posts).map((post) => {
      return {
        params: {
          category: post.split('/')[0],
          subcategory: post.split('/')[1],
          post: post.split('/')[2].replace(/\.mdx$/, '')
        }
      }
    }),
    fallback: false
  }
}
