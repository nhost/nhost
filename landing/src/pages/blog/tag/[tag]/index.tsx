import { BlogListing, BlogListingProps } from '@/components/blog/BlogListing'
import { getTagListingProps, getTagPageCounts } from '@/lib/blogListing'
import { GetStaticPaths, GetStaticProps } from 'next'

/** Posts with one popular tag. Rarer tags have no page. */
export default function BlogTagPage(props: BlogListingProps) {
  return <BlogListing key={props.seo.path} {...props} />
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: (await getTagPageCounts()).map(({ slug }) => ({
    params: { tag: slug },
  })),
  fallback: false,
})

export const getStaticProps: GetStaticProps<BlogListingProps> = async ({
  params,
}) => {
  const props = await getTagListingProps(String(params?.tag), 1)

  return props ? { props } : { notFound: true }
}
