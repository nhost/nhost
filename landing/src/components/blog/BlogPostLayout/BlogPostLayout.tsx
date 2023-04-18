import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { ArrowLeftIcon } from '@/components/common/icons/ArrowLeftIcon'
import { ImageWithLegend } from '@/components/common/ImageWithLegend'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { Link } from '@/components/common/Link'
import { Article } from '@/utils/types'
import { baseUrl } from '@/utils/utils'
import { MDXProvider } from '@mdx-js/react'
import { format, parseISO } from 'date-fns'
import Image from 'next/image'
import { PropsWithChildren, useEffect, useState } from 'react'
import 'react-medium-image-zoom/dist/styles.css'

// TODO: Break out the MDXProvider in its own MDX component
// TODO: make the image component work with Zoom so a user can zoom in on images
const components = {
  img: (props: any) => <ImageWithLegend {...props} />,
}

function Share({ title }: { title: string }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    setUrl(window.location.href)
  }, [])

  const urlEncoded = encodeURI(url)
  const titleEncoded = encodeURI(title)
  const twitterUrl = `https://twitter.com/intent/tweet?url=${urlEncoded}&text=${titleEncoded}`
  const linkedInUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${urlEncoded}&title=${titleEncoded}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`

  return (
    <div className="mx-auto mt-16 grid grid-flow-row justify-center gap-6 text-center">
      <p className="text-sm font-medium text-white text-opacity-65">
        Share this post
      </p>
      <div className="grid grid-flow-col justify-center gap-8">
        <Link href={twitterUrl} target="_blank" rel="noopener noreferrer">
          <Image
            src="/brands/brand-twitter.svg"
            width={18}
            height={18}
            alt="Twitter Logo"
          />
        </Link>
        <Link href={linkedInUrl} target="_blank" rel="noopener noreferrer">
          <Image
            src="/brands/brand-linkedin.svg"
            width={18}
            height={18}
            alt="LinkedIn Logo"
          />
        </Link>
        <Link href={facebookUrl} target="_blank" rel="noopener noreferrer">
          <Image
            src="/brands/brand-facebook.svg"
            width={18}
            height={18}
            alt="Facebook Logo"
          />
        </Link>
      </div>
    </div>
  )
}

export interface BlogPostLayout {
  /**
   * Article to render.
   */
  article: Article
}

export default function BlogPostLayout({
  children,
  article,
}: PropsWithChildren<BlogPostLayout>) {
  return (
    <Layout
      slotProps={{
        nextSeo: {
          title: article.title,
          description: article.description,
          openGraph: {
            images: [
              {
                url: `${baseUrl()}/${article.image}`,
                alt: `Cover image for ${article.title}`,
                width: 1920,
                height: 1080,
              },
            ],
          },
        },
      }}
    >
      <Container component="article" className="py-10">
        <Link href="/blog" className="text-opacity-100">
          <ArrowLeftIcon /> Back to Blog
        </Link>

        <div className="mt-10 grid grid-flow-row justify-start gap-4 sm:justify-center">
          <div className="mx-auto hidden grid-flow-col items-center justify-center gap-2 text-center text-sm text-white text-opacity-65 sm:grid">
            <span className="">{article.tags.join(' · ')}</span>
            <span>|</span>
            <span>{format(parseISO(article.date), 'd MMMM yyyy')}</span>
          </div>

          <span className="inline truncate text-white text-opacity-65 sm:hidden">
            {article.tags.join(' | ')}
          </span>

          <h1 className="font-mona text-4xl font-semibold sm:text-center md:text-4.5xl">
            {article.title}
          </h1>

          <span className="inline text-white text-opacity-65 sm:hidden">
            {format(parseISO(article.date), 'd MMMM yyyy')}
          </span>
        </div>

        <div className="mt-8 grid grid-flow-row gap-4">
          <span className="font-medium text-white text-opacity-65 sm:hidden">
            Posted by
          </span>

          <div className="no-scroll-bar grid grid-flow-col items-center justify-start gap-4 sm:justify-center">
            {article.authors.map((author) => {
              const authorComponent = (
                <div
                  key={author.name}
                  className="grid grid-flow-col items-center gap-2"
                >
                  <Image
                    src={`${author.avatarUrl}`}
                    width={50}
                    height={50}
                    alt={`Avatar of ${author.name}`}
                    className="h-8 w-8 max-w-none rounded-full"
                  />

                  <div className="grid grid-flow-row gap-1">
                    <div className="whitespace-nowrap md:whitespace-normal">
                      {author.name}
                    </div>
                    <div className="text-xs text-white text-opacity-65">
                      {author.title}
                    </div>
                  </div>
                </div>
              )

              if (!author.url) {
                return authorComponent
              }

              return (
                <Button
                  variant="borderless"
                  href={author.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="text-opacity-100 hover:no-underline"
                  key={author.name}
                  size="xs"
                >
                  {authorComponent}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="relative z-0 mt-16 min-h-[300px] overflow-hidden rounded-xl border border-divider px-12 pt-12">
          <div className="bg-glow-gradient backface-hidden absolute top-0 left-0 right-0 bottom-0 h-full w-full blur-[80px]" />
          <div className="bg-black-to-transparent absolute top-0 left-0 right-0 z-10 h-full w-full" />
          <LineGrid
            className="left-0 right-0 bottom-0 top-0 z-10 md:scale-150"
            slotProps={{
              image: {
                priority: true,
                className: 'h-auto w-full opacity-100',
              },
            }}
            priority
          />
          <div className="relative z-20 flex h-full items-center justify-center overflow-hidden rounded-t-[4px] border-divider border-opacity-50 shadow-cover">
            <Image
              src={article.image}
              width={1920}
              height={1080}
              alt={`Banner of ${article.title}`}
              priority
              quality={100}
            />
          </div>
        </div>

        <Container className="prose prose-invert mt-12 max-w-prose text-white text-opacity-65">
          <MDXProvider components={components}>{children}</MDXProvider>
        </Container>

        <Share title={article.title} />
      </Container>
    </Layout>
  )
}
