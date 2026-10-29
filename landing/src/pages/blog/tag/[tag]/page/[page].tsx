import { BlogListing, BlogListingProps } from '@/components/blog/BlogListing'
import { parsePageParam } from '@/lib/blogGrouping'
import { getTagListingProps, getTagPageCounts } from '@/lib/blogListing'
import { GetStaticPaths, GetStaticProps } from 'next'

/** A tag's later pages. Page 1 is /blog/tag/<slug> itself. */
export default function BlogTagListingPage(props: BlogListingProps) {
  return <BlogListing key={props.seo.path} {...props} />
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: (await getTagPageCounts()).flatMap(({ slug, totalPages }) =>
    Array.from({ length: totalPages - 1 }, (_, index) => ({
      params: { tag: slug, page: String(index + 2) },
    })),
  ),
  fallback: false,
})

export const getStaticProps: GetStaticProps<BlogListingProps> = async ({
  params,
}) => {
  // getTagListingProps checks the upper bound against the tag's own pages.
  const page = parsePageParam(params?.page, Number.POSITIVE_INFINITY)
  const props =
    page === null ? null : await getTagListingProps(String(params?.tag), page)

  return props ? { props } : { notFound: true }
}
