import rehypePrism from '@mapbox/rehype-prism'
import nextMDX from '@next/mdx'
import remarkGfm from 'remark-gfm'
import { remarkCodeHike } from '@code-hike/mdx'
import remarkReadingTime from './src/lib/remarkReadingTime.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['tsx', 'mdx'],
  reactStrictMode: true,
  experimental: {
    scrollRestoration: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      // Page 1 of a blog listing lives at its base path.
      {
        source: '/blog/page/1',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/blog/tag/:tag/page/1',
        destination: '/blog/tag/:tag',
        permanent: true,
      },
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
    providerImportSource: '@mdx-js/react',
    remarkPlugins: [
      // First, so it counts code blocks before Code Hike turns them into JSX.
      remarkReadingTime,
      [
        remarkCodeHike,
        {
          theme: 'github-dark',
          lineNumbers: true,
          showCopyButton: true,
        },
      ],
      remarkGfm,
    ],
    rehypePlugins: [rehypePrism],
  },
})

export default withMDX(nextConfig)
