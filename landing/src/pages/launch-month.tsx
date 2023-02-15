import { Layout } from '@/components/common/Layout'
import { SectionHeading } from '@/components/common/SectionHeading'
import { baseUrl } from '@/utils/utils'
import { format, intervalToDuration } from 'date-fns'
import { NextSeo } from 'next-seo'
import Link from 'next/link'
import { ReactNode, useEffect, useState } from 'react'

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

function PostDay({ date, post }: { date: Date; post: Post }) {
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
        title="Launch Month"
        description="Nhost Launch Month (February 2023) is a month-long event where we will be launching one new release every week for a month."
        openGraph={{
          type: 'website',
          images: [
            {
              url: `${baseUrl()}/blog/2023-01-18-launch-month-february-2023/banner.png`,
              alt: 'Nhost Launch Month',
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
        <div className=" text-white">
          <div className="max-w-container mx-auto py-16">
            <SectionHeading
              title={<>Nhost Launch Month</>}
              subtitle={<>February, 2023</>}
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
        <PostDay
          date={new Date('2023-02-01T16:00:00.000+02:00')}
          post={{
            image: '/images/blog/dark-mode/banner.png',
            title: 'Dark Mode',
            description:
              'You can put away your sunglasses, because today we are bringing Dark Mode to the Nhost Dashboard.',
            link: '/blog/dark-mode',
          }}
        />
        <PostDay
          date={new Date('2023-02-08T16:00:00.000+02:00')}
          post={{
            image: '/images/blog/new-branding-and-website/banner.png',
            title: 'New Branding and Website',
            description:
              "Today we're launching our new branding and website. Nedless to say, we like dark mode!",
            link: '/blog/new-branding-and-website',
          }}
        />
        <PostDay
          date={new Date('2023-02-15T16:00:00.000+02:00')}
          post={{
            image: '/images/blog/nextjs-stripe-starter-template/banner.png',
            title: 'Next.js Stripe Starter Template',
            description:
              "Save time and hassle building your next SaaS project with Nhost's fully-configured Next.js Stripe starter template, designed to get your subscription payments set up and running quickly.",
            link: '/blog/nextjs-stripe-starter-template',
          }}
        />
        <TbaDay date={new Date('2023-02-22T16:00:00.000+02:00')} />
      </div>
    </Layout>
  )
}
