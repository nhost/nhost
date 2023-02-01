import { Layout } from '@/components/Layout'
import Head from 'next/head'
import { format, parseISO } from 'date-fns'
import { Container } from '@/components/Container'

export function formatDate(dateString: string) {
  return new Date(`${dateString}T00:00:00Z`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
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

  return (
    <Layout>
      <Head>
        <title>{`${article.title}`}</title>
        <meta name="description" content={article.description} />
      </Head>
      <Container>
        <article>
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
          {/* https://tailwindcss.com/docs/typography-plugin#basic-usage */}
          <div className="prose prose-invert">{children}</div>
          <div>share this post</div>
          <div>
            <div>top related posts</div>
            <div>... TODO</div>
          </div>
        </article>
      </Container>
    </Layout>
  )
}
