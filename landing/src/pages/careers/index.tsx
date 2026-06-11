import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { Link } from '@/components/common/Link'
import { SectionHeading } from '@/components/common/SectionHeading'
import { jobs } from '@/data/jobs'
import Image from 'next/image'
import { NextSeo } from 'next-seo'
import { ReactElement } from 'react'

const values = [
  {
    title: 'Remote, global, async',
    description:
      "We hire the best people regardless of where they live. Async-first, outcome-driven, built for deep work.",
  },
  {
    title: 'Autonomy and ownership',
    description:
      'You own meaningful problems end-to-end. We trust engineers to make decisions, ship them, and learn from the results.',
  },
  {
    title: 'For developers, by developers',
    description:
      "Every person on the team genuinely cares about developer experience. We sweat the details because the people using our product do too.",
  },
  {
    title: 'Open and transparent',
    description:
      'Strategy, finances, roadmap — we share the context, so the team can make decisions with the same information leadership has.',
  },
]

const benefits = [
  {
    title: 'Competitive salary & equity',
    description:
      'A generous package based on experience. Real equity in a company building something that matters.',
  },
  {
    title: '25–30 days of vacation',
    description:
      'Recharge properly. Time off means actually switching off.',
  },
  {
    title: 'Work from anywhere',
    description:
      "100% remote, async by default. Work where you do your best thinking.",
  },
  {
    title: 'Equipment of your choice',
    description:
      'Pick the setup that lets you do your best work.',
  },
  {
    title: 'Learning budget',
    description:
      "A yearly allowance for books, courses, and conferences. We invest in your growth.",
  },
  {
    title: 'Team offsites',
    description:
      'Once or twice a year we meet up in person to ship, plan, and enjoy each other’s company.',
  },
]

export default function CareersPage() {
  return (
    <>
      <NextSeo
        title="Careers"
        description="Join Nhost and help build the future of application development. Remote-first, autonomous, and impact-driven."
      />

      <Container className="relative pt-8 pb-16 lg:pt-20 lg:pb-24">
        <div className="relative">
          <div className="bg-transparent-to-black-radial-gradient absolute top-1/2 left-0 right-0 bottom-0 z-0 mx-auto h-28 w-28 -translate-y-1/2" />
          <LineGrid
            className="left-0 right-0 top-1/2 mx-auto h-28 w-28 -translate-y-1/2"
            slotProps={{ image: { className: 'opacity-100' } }}
          />
          <Glow className="left-0 right-0 top-1/2 mx-auto h-24 w-24 -translate-y-1/2 bg-opacity-50 blur-3xl" />
          <Image
            src="/common/logo-shape.svg"
            width={24}
            height={24}
            alt="Nhost Logo"
            priority
            className="leading relative z-10 mx-auto h-16 w-16 object-contain"
          />
        </div>

        <SectionHeading
          title={
            <>
              Build the future of{' '}
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">
                application development
              </span>{' '}
              with us
            </>
          }
          subtitle="Nhost gives developers and agents the fastest, most reliable way to build, connect, and run modern backends without operational complexity."
          className="mt-12 max-w-3xl"
          slotProps={{
            title: {
              component: 'h1',
              className: '!leading-tight md:text-5xl md:!leading-[1.15]',
            },
            subtitle: { className: 'mx-auto max-w-2xl' },
          }}
        />

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button href="#open-positions" className="text-base">
            See open roles
            <ArrowRightIcon />
          </Button>
          <Button
            href="mailto:careers@nhost.io"
            variant="outlined"
            className="text-base"
          >
            Get in touch
          </Button>
        </div>
      </Container>

      <Container component="section" className="relative pb-20 lg:pb-28">
        <div className="border-gradient mx-auto mb-16 h-px w-10/12 lg:mb-24" />

        <div className="mx-auto grid max-w-5xl grid-flow-row gap-12 lg:grid-cols-12 lg:gap-x-16">
          <div className="lg:col-span-4">
            <span className="font-mona text-sm font-semibold uppercase tracking-[0.18em] text-brand-light">
              Our mission
            </span>
          </div>
          <div className="lg:col-span-8">
            <p className="font-mona text-2xl font-medium leading-snug md:text-3xl md:leading-snug">
              Nhost exists to give developers and agents the fastest way to build, connect, and run modern backends.
            </p>
            <p className="mt-6 text-lg leading-relaxed text-white text-opacity-65">
              We provide the core backend stack — database, auth, storage, GraphQL, containers, serverless functions, and AI-ready tooling — in one platform that is ready to use, easy to extend, and built to remove operational complexity.
            </p>
          </div>
        </div>
      </Container>

      <Container component="section" className="relative pb-20 lg:pb-28">
        <div className="relative z-0 overflow-hidden rounded-xl border border-divider">
          <LineGrid
            className="absolute inset-0 z-0 h-full w-full"
            slotProps={{ image: { className: 'h-full w-full object-cover opacity-40' } }}
          />
          <Glow className="absolute -top-12 left-0 right-0 z-0 mx-auto h-24 w-3/4 bg-opacity-30 blur-3xl" />

          <div className="relative z-10 grid grid-cols-1 gap-y-10 gap-x-6 py-12 px-6 sm:grid-cols-3 lg:py-16 lg:px-12">
            <Stat value="100%" label="Remote" />
            <Stat value="25–30" label="Vacation days" />
            <Stat value="Equity" label="For every hire" />
          </div>
        </div>
      </Container>

      <Container component="section" className="relative pb-20 lg:pb-28">
        <SectionHeading
          title="How we work"
          subtitle="The principles that shape how we hire, build, and work together."
          slotProps={{ title: { className: 'font-semibold' } }}
        />

        <div className="mx-auto mt-14 grid max-w-5xl grid-flow-row gap-x-12 gap-y-12 lg:mt-20 lg:grid-cols-2 lg:gap-y-16">
          {values.map((value, index) => (
            <div key={value.title} className="grid grid-flow-row gap-3">
              <div className="grid grid-flow-col items-center justify-start gap-4">
                <span className="font-mona text-sm font-semibold tabular-nums text-brand-main">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="h-px w-10 bg-divider" />
              </div>
              <h3 className="font-mona text-2xl font-semibold leading-snug">
                {value.title}
              </h3>
              <p className="text-base leading-relaxed text-white text-opacity-65">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </Container>

      <Container component="section" className="relative pb-20 lg:pb-28">
        <SectionHeading
          title="What you get"
          subtitle="The basics, done well."
          slotProps={{ title: { className: 'font-semibold' } }}
        />

        <div className="mt-14 overflow-hidden rounded-xl border border-divider bg-divider lg:mt-20">
          <div className="grid grid-flow-row gap-px sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="grid grid-flow-row gap-2 bg-default p-8 transition-colors hover:bg-white hover:bg-opacity-[0.015]"
              >
                <h3 className="font-mona text-lg font-semibold">
                  {benefit.title}
                </h3>
                <p className="text-sm leading-relaxed text-white text-opacity-65">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>

      <Container
        component="section"
        id="open-positions"
        className="relative pb-20 lg:pb-28"
      >
        <div className="relative">
          <Glow className="absolute -top-8 left-0 right-0 mx-auto h-20 w-1/2 bg-opacity-40 blur-3xl" />
          <SectionHeading
            title="Open positions"
            subtitle={`${jobs.length} open ${jobs.length === 1 ? 'role' : 'roles'} — find the one that fits.`}
            slotProps={{ title: { className: 'font-semibold relative z-10' } }}
            className="relative z-10"
          />
        </div>

        <div className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-xl border border-divider lg:mt-20">
          {jobs.map((job, index) => (
            <Link
              key={job.slug}
              href={`/careers/${job.slug}`}
              className={[
                'group relative grid grid-flow-row items-start gap-6 p-6 !text-white !text-opacity-100 !no-underline transition-colors hover:bg-white hover:bg-opacity-[0.02] lg:grid-cols-12 lg:items-center lg:gap-8 lg:p-10',
                index > 0 ? 'border-t border-divider' : '',
              ].join(' ')}
            >
              <span
                aria-hidden
                className="absolute left-0 top-0 bottom-0 w-px scale-y-0 bg-gradient-to-b from-transparent via-brand-main to-transparent opacity-0 transition-all duration-300 group-hover:scale-y-100 group-hover:opacity-100"
              />

              <div className="grid grid-flow-row gap-2 lg:col-span-7">
                <span className="font-mona text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
                  {job.department}
                </span>
                <h3 className="font-mona text-xl font-semibold leading-snug lg:text-2xl">
                  {job.title}
                </h3>
                <p className="text-base leading-relaxed text-white text-opacity-65">
                  {job.summary}
                </p>
              </div>

              <div className="grid grid-flow-col items-center justify-start gap-3 text-sm text-white text-opacity-65 lg:col-span-3 lg:grid-flow-row lg:gap-1.5 lg:justify-self-start">
                <span>{job.location}</span>
                <span className="lg:hidden">•</span>
                <span>{job.type}</span>
              </div>

              <div className="lg:col-span-2 lg:justify-self-end">
                <span className="inline-grid grid-flow-col items-center gap-2 text-sm font-medium text-white text-opacity-80 transition-colors group-hover:text-opacity-100">
                  View role
                  <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-2xl text-center lg:mt-24">
          <h3 className="font-mona text-2xl font-semibold md:text-3xl">
            Don&apos;t see a role for you?
          </h3>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white text-opacity-65">
            We&apos;re always interested in talking to exceptional people. If
            you think you can move the needle here, reach out — tell us what
            you&apos;d do and what you&apos;ve built.
          </p>
          <Button
            href="mailto:careers@nhost.io"
            variant="outlined"
            className="mt-8"
          >
            careers@nhost.io
          </Button>
        </div>
      </Container>
    </>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="grid grid-flow-row gap-2 text-center">
      <p className="font-mona text-3.5xl font-bold leading-none lg:text-5xl">
        {value}
      </p>
      <p className="text-sm text-white text-opacity-65 lg:text-base">{label}</p>
    </div>
  )
}

CareersPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
