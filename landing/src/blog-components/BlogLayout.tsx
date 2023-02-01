import { Layout } from '@/components/Layout'
import Head from 'next/head'

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
      <article>
        <header className="flex flex-col">
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-5xl">
            {article.title}
          </h1>
          <time
            dateTime={article.date}
            className="order-first flex items-center text-base text-zinc-400 dark:text-zinc-500"
          >
            <span className="h-4 w-0.5 rounded-full bg-zinc-200 dark:bg-zinc-500" />
            <span className="ml-3">{formatDate(article.date)}</span>
          </time>
        </header>
        <div className="mt-8">{children}</div>
      </article>
    </Layout>
  )
}
