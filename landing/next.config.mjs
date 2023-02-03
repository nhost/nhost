import rehypePrism from '@mapbox/rehype-prism'
import nextMDX from '@next/mdx'
import remarkGfm from 'remark-gfm'

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['tsx', 'mdx'],
  reactStrictMode: true,
  images: {
    deviceSizes: [
      82, 110, 140, 330, 588, 640, 750, 828, 1024, 1080, 1200, 1920, 2048, 3840,
    ],
  },
  experimental: {
    scrollRestoration: true,
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
