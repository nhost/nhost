import { Container } from '@/components/Container'
import { Content } from '@/components/Content'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import components from '@/components/MDX/components'
import { Nav } from '@/components/Nav'
import { NavigationProvider } from '@/components/NavigationContext'
import { createConvolutedNav, getAllPosts } from '@/lib/post'
import { capitalize } from '@/utils/capitalize'
import fs from 'fs'
import matter from 'gray-matter'
import { serialize } from 'next-mdx-remote/serialize'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { join } from 'path'
import React from 'react'

import { Main } from '../../components/Main'
import { SubNavigation } from '../../components/SubNavigation'
import { TopNavigation } from '../../components/TopNavigation'

export default function Post({
  category,
  subcategory,
  frontmatter,
  mdxSource,
  convolutedNav,
  post,
  categoryTitle,
  availableMenus
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

  const fullPath = join(postsDirectory, `${params.category}/${params.subcategory}/index.mdx`)
  const categoryTitle = matter(
    fs.readFileSync(join(postsDirectory, `${params.category}/index.mdx`), 'utf8')
  ).data.title

  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)
  const mdxSource = await serialize(content)

  return {
    props: {
      category: params.category,
      categoryTitle,
      subcategory: params.subcategory,
      frontmatter: { ...data },
      mdxSource,
      availableMenus: convolutedNavs,
      convolutedNav
    }
  }
}

export async function getStaticPaths() {
  const { categoriesAndSubcategories } = getAllPosts()

  return {
    paths: categoriesAndSubcategories.map((sub) => {
      return {
        params: {
          category: sub.split('/')[0],
          subcategory: sub.split('/')[1]
        }
      }
    }),
    fallback: false
  }
}
