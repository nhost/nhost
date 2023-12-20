import { Layout } from '@/components/common/Layout'
import { SectionHeading } from '@/components/common/SectionHeading'
import { baseUrl } from '@/utils/utils'
import { format, intervalToDuration } from 'date-fns'
import { NextSeo } from 'next-seo'
import { ReactNode, useEffect, useState } from 'react'
import ContentLoader from 'react-content-loader'
import Link from 'next/link'

function Unit({ value, unit }: { value: ReactNode; unit: string }) {
  return (
    <div className="grid">
      <div className="font-sans text-2xl font-medium md:text-3xl">{value}</div>
      <div className="text-greyscaleGrey text-base font-medium">{unit}</div>
    </div>
  )
}

interface Post {
  image: string
  title: string
  description: string
  link: string
}

function TbaDay({ date }: { date: Date }) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const { days, hours, minutes, seconds } = intervalToDuration({
    start: currentDate,
    end: date,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date())
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="font-display text-greyscaleDark mx-auto grid w-full overflow-hidden rounded-lg border border-gray-800 sm:grid-cols-5">
      <div className="col-span-2 h-80 bg-slate-900 p-6">
        <div className="text-sm">New Release</div>
        <div className="text-3xl font-medium">Coming soon</div>
      </div>

      <div className="grid w-full grid-flow-row justify-between gap-3 p-6 sm:col-span-3 sm:gap-0">
        <div className="grid w-full content-start gap-2">
          <div className="text-greyscaleDarkGrey text-sm">
            {format(date, 'MMMM d, yyyy')}
          </div>

          <div className="text-3xl font-semibold">To Be Announced</div>
        </div>

        <div className="grid w-full grid-flow-col content-end items-center justify-start gap-6 font-sans sm:gap-8 md:gap-12">
          <Unit value={days} unit={days === 1 ? 'day' : 'days'} />
          <Unit value={hours} unit={hours === 1 ? 'hour' : 'hours'} />
          <Unit value={minutes} unit={minutes === 1 ? 'minute' : 'minutes'} />
          <Unit value={seconds} unit={seconds === 1 ? 'second' : 'seconds'} />
        </div>
      </div>
    </div>
  )
}

function TbaDayDelayed({ date }: { date: Date }) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const { days, hours, minutes, seconds } = intervalToDuration({
    start: currentDate,
    end: date,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date())
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="font-display text-greyscaleDark mx-auto grid w-full overflow-hidden rounded-lg border border-gray-800 sm:grid-cols-5">
      <div className="col-span-2 h-80 bg-slate-900 p-6">
        <div className="text-sm">New Release</div>
        <div className="text-3xl font-medium">Coming soon (delayed)</div>
      </div>

      <div className="grid w-full grid-flow-row justify-between gap-3 p-6 sm:col-span-3 sm:gap-0">
        <div className="grid w-full content-start gap-2">
          <div className="text-greyscaleDarkGrey text-sm">
            {format(date, 'MMMM d, yyyy')}
          </div>

          <div className="text-3xl font-semibold">Delayed</div>
          <div className="text-greyscaleDarkGrey my-4 text-lg">
            {
              "Unfortunately, this launch has been delayed due to unexpected issues. But don't worry, we're working hard to fix things and get back on track - we're not rocket scientists, but we're pretty close!"
            }
          </div>
        </div>

        <div className="grid w-full grid-flow-col content-end items-center justify-start gap-6 font-sans sm:gap-8 md:gap-12">
          <Unit value={days} unit={days === 1 ? 'day' : 'days'} />
          <Unit value={hours} unit={hours === 1 ? 'hour' : 'hours'} />
          <Unit value={minutes} unit={minutes === 1 ? 'minute' : 'minutes'} />
          <Unit value={seconds} unit={seconds === 1 ? 'second' : 'seconds'} />
        </div>
      </div>
    </div>
  )
}

function PostDay({ date, post }: { date: Date; post: Post }) {
  const { image, title, description } = post

  return (
    <div
      className="font-display text-greyscaleDark mx-auto flex w-full overflow-hidden rounded-lg border border-gray-900 sm:grid-cols-5"
    >
      <div
        className="col-span-2 flex h-80 flex-1 bg-gray-400 blur-lg"
        style={{
          background: `url(${image})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      <div className="flex h-full w-full flex-1 grid-flow-row flex-col justify-center gap-3 p-6 sm:col-span-3 sm:gap-0">
        <div className="flex w-full flex-col content-start gap-2">
          <div className="text-greyscaleDarkGrey text-sm">
            {format(date, 'MMMM d, yyyy')}
          </div>

          <div className="mb-4 text-3xl font-semibold">{title}</div>
          <div className="w-full ">
            <ContentLoader
              viewBox="0 0 380 89"
              backgroundColor="#262626"
              foregroundColor="#080808"
              animate={true}
            >
              {/* Only SVG shapes */}
              <rect x="0" y="10" rx="4" ry="4" width="380" height="9" />
              <rect x="0" y="30" rx="3" ry="3" width="380" height="9" />
              <rect x="0" y="50" rx="3" ry="3" width="280" height="9" />
            </ContentLoader>
          </div>
        </div>
      </div>
    </div>
  )
}

function AvailablePostDay({ date, post }: { date: Date; post: Post }) {
  const { image, title, description, link } = post

  return (
    <Link
      href={link}
      className="font-display text-greyscaleDark mx-auto grid w-full overflow-hidden rounded-lg border border-gray-900 sm:grid-cols-5"
    >
      <div
        className="col-span-2 h-80 bg-gray-400 "
        style={{
          background: `url(${image})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* <img src={image} className="h-full" alt={title} /> */}
      </div>

      <div className="grid h-full w-full grid-flow-row justify-between gap-3 p-6 sm:col-span-3 sm:gap-0">
        <div className="grid w-full content-start gap-2">
          <div className="text-greyscaleDarkGrey text-sm">
            {format(date, 'MMMM d, yyyy')}
          </div>

          <div className="text-3xl font-semibold">{title}</div>
          <div className="text-greyscaleDarkGrey my-4 text-lg">
            {description}
          </div>
        </div>
        <div>
          <span className="text-blueHero flex align-bottom text-lg font-medium">
            Read more{' '}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="ml-2 h-4 w-4 self-center"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function Page() {
  return (
    <Layout>
      <NextSeo
        title="AI Week"
        description="Nhost AI Week (December 2023) is a week-long event where we will be announcing and demoing one new feature every day for a week."
        openGraph={{
          type: 'website',
          images: [
            {
              url: `${baseUrl()}/blog/2023-01-18-launch-month-february-2023/banner.png`,
              alt: 'Nhost AI Week',
            },
          ],
        }}
      />
      <div
        className="font-display mt-[105px]"
        style={
          {
            // background: 'linear-gradient(315deg, #310082 0%, #0039CD 100%)',
          }
        }
      >
        <div className="text-white ">
          <div className="max-w-container mx-auto py-16">
            <SectionHeading
              title={<>Nhost AI Week</>}
              subtitle={<>December 18-22, 2023</>}
              slotProps={{
                title: {
                  component: 'h1',
                  className: 'text-3.5xl md:text-5xl font-bold',
                },
              }}
            />
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl grid-flow-row gap-12 px-4 py-16">
        <AvailablePostDay
          date={new Date('2023-12-18T16:00:00.000+02:00')}
          post={{
            image: '/images/blog/auto-embeddings/auto-embeddings.png',
            title: 'Nhost Postgres Vector & Auto-Embeddings',
            description: 'Store and Search through Embeddings with Nhost Postgres and Auto-Embeddings.',
            link: '/blog/auto-embeddings',
          }}
        />
        <AvailablePostDay
          date={new Date('2023-12-19T16:00:00.000+02:00')}
          post={{
            image: '/images/blog/assistants/assistants.png',
            title: 'Nhost Assistants',
            description: "LLMs tailored to your needs.",
            link: '/blog/nhost-assistants'
          }}
        />
        <AvailablePostDay
          date={new Date('2023-12-20T16:00:00.000+02:00')}
          post={{
            image: '/images/blog/dev-assistant/dev-assistant.png',
            title: 'Graphite, your Developer Assistant',
            description: "Go from idea to production faster",
            link: '',
          }}
        />
        <PostDay
          date={new Date('2023-12-21T16:00:00.000+02:00')}
          post={{
            image: '/images/blog/dark-mode/banner.png',
            title: 'Coming soon',
            description: '',
            link: '',
          }}
        />
        <PostDay
          date={new Date('2023-12-22T16:00:00.000+02:00')}
          post={{
            image: '/images/blog/dark-mode/banner.png',
            title: 'Coming soon',
            description: '',
            link: '',
          }}
        />
        {/* <TbaDayDelayed date={new Date('2023-02-22T16:00:00.000+02:00')} /> */}
      </div>
    </Layout>
  )
}
