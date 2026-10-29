import { BlogListing, BlogListingProps } from '@/components/blog/BlogListing'
import { parsePageParam } from '@/lib/blogGrouping'
import { getBlogListingProps, getBlogPageCount } from '@/lib/blogListing'
import { GetStaticPaths, GetStaticProps } from 'next'

/** /blog/page/2 and on. Page 1 is /blog itself. */
export default function BlogListingPage(props: BlogListingProps) {
  return <BlogListing key={props.seo.path} {...props} />
}

export const getStaticPaths: GetStaticPaths = async () => {
  const totalPages = await getBlogPageCount()

  return {
    paths: Array.from({ length: totalPages - 1 }, (_, index) => ({
      params: { page: String(index + 2) },
    })),
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<BlogListingProps> = async ({
  params,
}) => {
  const page = parsePageParam(params?.page, await getBlogPageCount())

  if (page === null) {
    return { notFound: true }
  }

  return { props: await getBlogListingProps(page) }
}
