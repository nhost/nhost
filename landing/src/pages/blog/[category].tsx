import { BlogPostGrid } from '@/components/blog/BlogPostGrid'
import { BlogSearchField } from '@/components/blog/BlogSearchField'
import { ArrowLeftIcon } from '@/components/common/icons/ArrowLeftIcon'
import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { Link } from '@/components/common/Link'
import { SectionHeading } from '@/components/common/SectionHeading'
import { blogCategories, getBlogCategory } from '@/data/blogCategories'
import { useArticleSearch } from '@/hooks/useArticleSearch'
import { getAllArticles } from '@/lib/blog'
import { buildSeo } from '@/utils/seo'
import { Article } from '@/utils/types'
import { GetStaticPaths, GetStaticProps } from 'next'

/** How many posts show at first, and how many more each "Load more" adds. */
const PAGE_SIZE = 10

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
  // Only this category's posts reach the page, so search stays inside it.
  const { query, setQuery, isFiltering, results, visible, hasMore, loadMore } =
    useArticleSearch(articles, PAGE_SIZE)

  return (
    <Layout slotProps={{ nextSeo: buildSeo(seo) }}>
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
        <Link href="/blog">
          <ArrowLeftIcon /> Back to all posts
        </Link>

        <BlogSearchField
          id="blog-category-search"
          label={`Search ${label} posts`}
          value={query}
          onChange={setQuery}
          placeholder={`Search ${label}`}
        />

        {isFiltering && results.length === 0 ? (
          <p className="text-center text-sm text-white text-opacity-65">
            No posts match.
          </p>
        ) : (
          <BlogPostGrid articles={visible} />
        )}

        {hasMore && (
          <Button
            type="button"
            variant="outlined"
            onClick={loadMore}
            className="mt-10 justify-self-center"
          >
            Load more
          </Button>
        )}
      </Container>
    </Layout>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  // Categories share /blog/<slug> with posts, and a post page wins over this
  // dynamic route, so a post named after a category would hide the category.
  const postSlugs = new Set(
    (await getAllArticles()).map((article) => article.slug),
  )
  const clash = blogCategories.find((category) => postSlugs.has(category.slug))

  if (clash) {
    throw new Error(
      `Blog post "${clash.slug}" uses the same URL as the "${clash.label}" category. Rename the post.`,
    )
  }

  return {
    paths: blogCategories.map((category) => ({
      params: { category: category.slug },
    })),
    fallback: false,
  }
}

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
        path: `/blog/${slug}`,
        // `_app.tsx` appends "| Nhost" via titleTemplate, so no suffix here.
        title: `${category.label} on the Nhost blog`,
        description: category.description,
      },
    },
  }
}
