import { Layout } from '@/components/Layout'
import Head from 'next/head'
import { format, parseISO } from 'date-fns'
import { Container } from '@/components/Container'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export function formatDate(dateString: string) {
  return new Date(`${dateString}T00:00:00Z`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function Share({ title }: { title: string }) {
  const [url, setUrl] = useState('')

  // will do this client side to correctly get the url
  useEffect(() => {
    setUrl(window.location.href)
  }, [])

  const urlEncoded = encodeURI(url)
  const titleEncoded = encodeURI(title)
  const twitterUrl = `https://twitter.com/intent/tweet?url=${urlEncoded}&text=${titleEncoded}`
  const linkedInUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${urlEncoded}&title=${titleEncoded}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`

  if (!url) return null

  return (
    <div>
      <div>Share this post</div>
      <div>
        <a href={twitterUrl} target="_blank" rel="noopener noreferrer">
          Twitter
        </a>
        <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">
          LinkedIn
        </a>
        <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
          Facebook
        </a>
      </div>
    </div>
  )
}

// TODO: import same Article interface from blog/index.tsx
export function BlogLayout({
  children,
  article,
}: {
  children: any
  article: any
}) {
  console.log(article)

  useEffect(() => {})

  return (
    <Layout>
      <Container>
        <article>
          <div>
            <Link href="/blog">Back to blog</Link>
          </div>
          <div>
            <div>
              {article.tags.map((tag: any) => {
                return <span key={tag}>{tag}</span>
              })}
            </div>
            <div>{format(parseISO(article.date), 'd MMMM yyyy')}</div>
          </div>
          <h1>{article.title}</h1>
          <div>
            {article.authors.map((author: any) => {
              // TODO: Link to author's `url`
              return (
                <div key={author.name}>
                  <div>
                    {' '}
                    <img
                      key={author.avatarUrl}
                      src={`${author.avatarUrl}`}
                      width={50}
                      height={50}
                      alt={author.name}
                    />
                  </div>
                  <div>
                    <div>{author.name}</div>
                    <div>{author.title}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div>
            <img src={`/images/blog/${article.image}`} width={800} alt="" />
          </div>
          <div className="prose prose-invert">{children}</div>
          <Share title={article.title} />
          <div>
            <div>top related posts</div>
            <div>... TODO</div>
          </div>
        </article>
      </Container>
    </Layout>
  )
}
