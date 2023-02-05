import rehypePrism from '@mapbox/rehype-prism'
import nextMDX from '@next/mdx'
import remarkGfm from 'remark-gfm'

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['tsx', 'mdx'],
  reactStrictMode: true,
  experimental: {
    scrollRestoration: true,
  },
  async redirects() {
    return [
      {
        source: '/blog/how-we-raised-3m-without-leaving-the-house',
        destination: '/blog/how-we-raised-3m-dollars-without-leaving-the-house',
        permanent: true,
      },
      {
        source: '/discord',
        destination: 'https://discord.gg/9V7Qb2U',
        permanent: true,
      },
      {
        source: '/blog/upload-files-with-hasura-and-hasura-and-hasura-storage',
        destination: '/blog/upload-files-with-hasura-and-hasura-storage',
        permanent: true,
      },
    ]
  },
}

const withMDX = nextMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypePrism],
  },
})

export default withMDX(nextConfig)
