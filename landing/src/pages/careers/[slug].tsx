import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowLeftIcon } from '@/components/common/icons/ArrowLeftIcon'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { CheckmarkCircleIcon } from '@/components/common/icons/CheckmarkCircleIcon'
import { LocationIcon } from '@/components/common/icons/LocationIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { Link } from '@/components/common/Link'
import { getJobBySlug, Job, jobs } from '@/data/jobs'
import { buildSeo } from '@/utils/seo'
import { GetStaticPaths, GetStaticProps } from 'next'
import { NextSeo } from 'next-seo'
import { ReactElement } from 'react'

export interface JobPageProps {
  job: Job
}

interface JobSectionProps {
  title: string
  description?: string
  items: string[]
  bulletIcon?: 'check' | 'dot'
}

function JobSection({
  title,
  description,
  items,
  bulletIcon = 'check',
}: JobSectionProps) {
  return (
    <section className="grid grid-flow-row gap-6">
      <div className="grid grid-flow-row gap-2">
        <h2 className="font-mona text-2xl font-semibold lg:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="text-base text-white text-opacity-65">{description}</p>
        )}
      </div>

      <ul className="grid grid-flow-row gap-3">
        {items.map((item) => (
          <li
            key={item}
            className="grid grid-flow-col items-start justify-start gap-3"
          >
            {bulletIcon === 'check' ? (
              <CheckmarkCircleIcon className="mt-1 shrink-0 text-brand-main" />
            ) : (
              <span
                aria-hidden
                className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white bg-opacity-65"
              />
            )}
            <span className="text-base leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function JobPage({ job }: JobPageProps) {
  const applySubject = encodeURIComponent(job.title)

  return (
    <>
      <NextSeo
        {...buildSeo({
          path: `/careers/${job.slug}`,
          title: job.title,
          description: job.summary,
        })}
      />
      <Container component="section" className="relative pt-12 lg:pt-20">
        <div className="mb-8">
          <Link
            href="/careers"
            className="text-sm text-white text-opacity-65 hover:text-opacity-100"
          >
            <ArrowLeftIcon />
            All open positions
          </Link>
        </div>
      </Container>

      <Container
        component="section"
        className="relative max-w-4xl pb-12 lg:pb-20"
      >
        <LineGrid
          className="top-0 left-0 right-0 mx-auto h-24 w-24 lg:top-0 lg:h-32 lg:w-32"
          slotProps={{ image: { className: 'mx-auto opacity-50' } }}
        />
        <Glow className="top-0 h-24 w-24 bg-opacity-40 blur-3xl lg:top-0 lg:h-32" />

        <div className="relative z-10 grid grid-flow-row gap-6 text-center">
          <span className="font-mona text-sm font-semibold uppercase tracking-wider text-brand-light">
            {job.department}
          </span>
          <h1 className="font-mona text-3.5xl font-semibold leading-tight md:text-5xl md:leading-normal">
            {job.title}
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-white text-opacity-65">
            {job.summary}
          </p>
        </div>

        <div className="relative z-10 mt-10 flex flex-wrap items-center justify-center gap-3 lg:mt-12">
          <span className="inline-grid grid-flow-col items-center gap-2 rounded-md border border-divider bg-paper px-4 py-2 text-sm">
            <LocationIcon />
            {job.location}
          </span>
          <span className="inline-grid grid-flow-col items-center gap-2 rounded-md border border-divider bg-paper px-4 py-2 text-sm">
            {job.type}
          </span>
          <span className="inline-grid grid-flow-col items-center gap-2 rounded-md border border-divider bg-paper px-4 py-2 text-sm">
            {job.vacation} vacation
          </span>
        </div>

        <div className="relative z-10 mt-8 flex justify-center lg:mt-12">
          <Button
            href={`mailto:careers@nhost.io?subject=${applySubject}`}
            className="text-base"
          >
            Apply for this role
            <ArrowRightIcon />
          </Button>
        </div>
      </Container>

      <Container
        component="article"
        className="relative max-w-3xl pb-16 lg:pb-24"
      >
        <div className="border-t border-divider pt-12 lg:pt-16">
          <section className="grid grid-flow-row gap-4">
            <h2 className="font-mona text-2xl font-semibold lg:text-3xl">
              About the role
            </h2>
            <p className="text-base leading-relaxed text-white text-opacity-80">
              {job.about}
            </p>
          </section>
        </div>

        <div className="mt-12 grid grid-flow-row gap-12 lg:mt-16 lg:gap-16">
          <JobSection
            title="What will you do?"
            items={job.responsibilities}
            bulletIcon="check"
          />

          <JobSection
            title="What are we looking for?"
            items={job.requirements}
            bulletIcon="check"
          />

          <JobSection
            title="Nice to haves"
            items={job.niceToHaves}
            bulletIcon="dot"
          />

          <JobSection
            title="What we offer"
            items={job.benefits}
            bulletIcon="check"
          />
        </div>

        <section className="mt-12 rounded-lg border border-divider bg-paper p-8 lg:mt-16 lg:p-10">
          <p className="text-base italic leading-relaxed text-white text-opacity-80">
            {job.closingNote}
          </p>
        </section>

        <section className="mt-12 grid grid-flow-row gap-6 lg:mt-16">
          <h2 className="font-mona text-2xl font-semibold lg:text-3xl">
            How to apply
          </h2>
          <p className="text-base leading-relaxed text-white text-opacity-80">
            Does this role sound like a good fit? Email us at{' '}
            <Link
              href="mailto:careers@nhost.io"
              className="!inline !text-white !text-opacity-100 underline"
            >
              careers@nhost.io
            </Link>
            .
          </p>
          <ul className="grid grid-flow-row gap-3">
            <li className="grid grid-flow-col items-start justify-start gap-3">
              <span
                aria-hidden
                className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white bg-opacity-65"
              />
              <span className="text-base leading-relaxed">
                Include the role&apos;s title in your subject line.
              </span>
            </li>
            <li className="grid grid-flow-col items-start justify-start gap-3">
              <span
                aria-hidden
                className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white bg-opacity-65"
              />
              <span className="text-base leading-relaxed">
                <span className="text-white text-opacity-65">[Optional]</span>{' '}
                Send along links that best showcase the relevant things
                you&apos;ve built and done.
              </span>
            </li>
          </ul>

          <div className="mt-4">
            <Button
              href={`mailto:careers@nhost.io?subject=${applySubject}`}
              className="text-base"
            >
              Apply for this role
              <ArrowRightIcon />
            </Button>
          </div>
        </section>
      </Container>

      <Container component="section" className="relative pb-16 lg:pb-28">
        <div className="border-t border-divider pt-16 lg:pt-24">
          <h2 className="font-mona text-2xl font-semibold lg:text-3xl">
            Other open roles
          </h2>

          <div className="mt-8 grid grid-flow-row gap-4">
            {jobs
              .filter((other) => other.slug !== job.slug)
              .map((other) => (
                <Link
                  key={other.slug}
                  href={`/careers/${other.slug}`}
                  className="group grid grid-flow-row items-start gap-6 rounded-lg border border-divider bg-paper p-6 !text-white !text-opacity-100 !no-underline transition-colors hover:border-white hover:border-opacity-20 lg:grid-cols-12 lg:items-center lg:gap-8 lg:p-8"
                >
                  <div className="grid grid-flow-row gap-2 lg:col-span-7">
                    <span className="font-mona text-xs font-semibold uppercase tracking-wider text-brand-light">
                      {other.department}
                    </span>
                    <h3 className="font-mona text-xl font-semibold leading-snug">
                      {other.title}
                    </h3>
                    <p className="text-base text-white text-opacity-65">
                      {other.summary}
                    </p>
                  </div>

                  <div className="grid grid-flow-col items-center justify-start gap-4 text-sm text-white text-opacity-65 lg:col-span-3 lg:grid-flow-row lg:gap-1 lg:justify-self-start">
                    <span>{other.location}</span>
                    <span className="lg:hidden">•</span>
                    <span>{other.type}</span>
                  </div>

                  <div className="lg:col-span-2 lg:justify-self-end">
                    <span className="inline-grid grid-flow-col items-center gap-2 rounded-md border border-divider px-4 py-2 text-sm font-medium transition-colors group-hover:bg-white group-hover:bg-opacity-10">
                      View role
                      <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/careers"
              className="!inline-grid grid-flow-col items-center gap-2 text-base !text-white !text-opacity-100"
            >
              <ArrowLeftIcon />
              Back to all positions
            </Link>
          </div>
        </div>
      </Container>
    </>
  )
}

JobPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: jobs.map((job) => ({ params: { slug: job.slug } })),
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<JobPageProps> = async ({
  params,
}) => {
  const slug = params?.slug as string
  const job = getJobBySlug(slug)

  if (!job) {
    return { notFound: true }
  }

  return { props: { job } }
}
