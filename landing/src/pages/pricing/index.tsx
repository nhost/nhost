import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { CheckmarkCircleIcon } from '@/components/common/icons/CheckmarkCircleIcon'
import { XIcon } from '@/components/common/icons/XIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ReactElement, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

function PricingListItem({
  title,
  freeContent,
  proContent,
  enterpriseContent,
  checkFree,
  checkPro,
  checkEnterprise,
}: {
  title: ReactNode
  freeContent?: ReactNode
  proContent?: ReactNode
  enterpriseContent?: ReactNode
  checkFree?: boolean
  checkPro?: boolean
  checkEnterprise?: boolean
}) {
  return (
    <li className="grid auto-cols-fr grid-flow-col gap-6 py-4">
      <span className="col-span-5 text-white text-opacity-65">{title}</span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-white',
          !checkFree && 'text-opacity-65',
        )}
      >
        {checkFree ? <CheckmarkCircleIcon /> : freeContent}
      </span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-white',
          !checkFree && 'text-opacity-65',
        )}
      >
        {checkPro ? <CheckmarkCircleIcon /> : proContent}
      </span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-white',
          !checkFree && 'text-opacity-65',
        )}
      >
        {checkEnterprise ? <CheckmarkCircleIcon /> : enterpriseContent}
      </span>
    </li>
  )
}

export default function PricingPage() {
  return (
    <>
      <Container
        component="section"
        className="relative flex max-w-5xl py-20 lg:py-28"
      >
        <LineGrid
          className="-top-5 left-0 right-0 mx-auto h-32 w-32 translate-x-0 scale-100 lg:top-5 lg:h-40 lg:w-40"
          slotProps={{ image: { className: 'mx-auto' } }}
          priority
        />
        <Glow className="h-10 w-32 blur-[50px] lg:top-28" />
        <SectionHeading
          title="Pricing"
          subtitle="Select your plan and start building"
          slotProps={{
            title: {
              component: 'h1',
              className: 'text-3.5xl md:text-5xl',
            },
          }}
          className="relative z-10"
        />
      </Container>

      <div className="sticky top-16 grid auto-cols-fr grid-flow-col content-start gap-6 bg-black py-4">
        <div className="col-span-5" />

        <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
          <SectionHeading
            title="Starter"
            subtitle="Free forever"
            className="gap-2"
            slotProps={{
              title: { className: 'text-3xl md:text-3xl' },
              subtitle: { className: 'text-base' },
            }}
          />

          <Button
            href="https://app.nhost.io/signup"
            rel="noopener noreferrer"
            target="_blank"
          >
            Start for free <ArrowRightIcon />
          </Button>
        </div>

        <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
          <SectionHeading
            title="Pro"
            subtitle="$25/mo"
            className="gap-2"
            slotProps={{
              title: { className: 'text-3xl md:text-3xl' },
              subtitle: { className: 'text-base' },
            }}
          />

          <p className="px-6 py-3 text-center">Buy Pro</p>
        </div>

        <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
          <SectionHeading
            title="Enterprise"
            subtitle="Custom plan"
            className="gap-2"
            slotProps={{
              title: { className: 'text-3xl md:text-3xl' },
              subtitle: { className: 'text-base' },
            }}
          />

          <p className="px-6 py-3 text-center">Contact Us</p>
        </div>
      </div>

      <Container className="grid auto-rows-auto items-start gap-8">
        <section className="mt-4">
          <h3 className="py-4 text-xl">Database</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Postgres"
              checkFree
              checkPro
              checkEnterprise
            />

            <PricingListItem
              title="Size"
              freeContent="500 MB"
              proContent="10 GB"
              enterpriseContent="Up to 5 TB"
            />

            <PricingListItem
              title="Per extra 10 GB"
              proContent="$20"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Custom API requests"
              checkFree
              checkPro
              checkEnterprise
            />

            <PricingListItem
              title="Event triggers"
              checkFree
              checkPro
              checkEnterprise
            />

            <PricingListItem
              title="Always available"
              freeContent="Sleep after 7 days of inactivity"
              checkPro
              checkEnterprise
            />

            <PricingListItem
              title="Backups"
              freeContent={<XIcon className="h-5 w-5 text-white" />}
              proContent="7 days"
              enterpriseContent="Custom"
            />
          </ul>
        </section>
      </Container>
    </>
  )
}

PricingPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
