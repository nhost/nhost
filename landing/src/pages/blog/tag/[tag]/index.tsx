import { BlogListing, BlogListingProps } from '@/components/blog/BlogListing'
import { getTagListingProps, getTagSlugs } from '@/lib/blogListing'
import { GetStaticPaths, GetStaticProps } from 'next'

/** A tag's posts. */
export default function BlogTagPage(props: BlogListingProps) {
  return <BlogListing key={props.seo.path} {...props} />
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: (await getTagSlugs()).map((tag) => ({ params: { tag } })),
  fallback: false,
})

export const getStaticProps: GetStaticProps<BlogListingProps> = async ({
  params,
}) => {
  const props = await getTagListingProps(String(params?.tag))

  return props ? { props } : { notFound: true }
}
