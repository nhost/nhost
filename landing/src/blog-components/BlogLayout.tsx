import Head from "next/head";
import { useRouter } from "next/router";

export function formatDate(dateString: string) {
  return new Date(`${dateString}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function BlogLayout({
  children,
  meta,
  previousPathname,
}: {
  children: any;
  meta: any;
  previousPathname: any;
}) {
  let router = useRouter();

  // if (isRssFeed) {
  //   return children;
  // }

  return (
    <>
      <Head>
        <title>{`${meta.title}`}</title>
        <meta name='description' content={meta.description} />
      </Head>
      <article>
        <header className='flex flex-col'>
          <h1 className='mt-6 text-4xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-5xl'>
            {meta.title}
          </h1>
          <time
            dateTime={meta.date}
            className='order-first flex items-center text-base text-zinc-400 dark:text-zinc-500'
          >
            <span className='h-4 w-0.5 rounded-full bg-zinc-200 dark:bg-zinc-500' />
            <span className='ml-3'>{formatDate(meta.date)}</span>
          </time>
        </header>
        <div className='mt-8'>{children}</div>
      </article>
    </>
  );
}
