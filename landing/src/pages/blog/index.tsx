import { BlogListing, BlogListingProps } from '@/components/blog/BlogListing'
import { getBlogListingProps } from '@/lib/blogListing'
import { GetStaticProps } from 'next'

export default function BlogPage(props: BlogListingProps) {
  return <BlogListing key={props.seo.path} {...props} />
}

export const getStaticProps: GetStaticProps<BlogListingProps> = async () => ({
  props: await getBlogListingProps(),
})
