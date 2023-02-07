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
  freeIcon,
  proIcon,
  enterpriseIcon,
}: {
  title: ReactNode
  freeContent?: ReactNode
  proContent?: ReactNode
  enterpriseContent?: ReactNode
  freeIcon?: 'check' | 'x'
  proIcon?: 'check' | 'x'
  enterpriseIcon?: 'check' | 'x'
}) {
  return (
    <li className="grid auto-cols-fr grid-flow-col gap-6 py-4">
      <span className="col-span-5 text-white text-opacity-65">{title}</span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-white',
          !freeIcon && 'text-opacity-65',
        )}
      >
        {freeIcon === 'check' && <CheckmarkCircleIcon className="h-5 w-5" />}
        {freeIcon === 'x' && <XIcon className="h-5 w-5" />}
        {!freeIcon && freeContent}
      </span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-white',
          !proIcon && 'text-opacity-65',
        )}
      >
        {proIcon === 'check' && <CheckmarkCircleIcon className="h-5 w-5" />}
        {proIcon === 'x' && <XIcon className="h-5 w-5" />}
        {!proIcon && proContent}
      </span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-white',
          !enterpriseIcon && 'text-opacity-65',
        )}
      >
        {enterpriseIcon === 'check' && (
          <CheckmarkCircleIcon className="h-5 w-5" />
        )}
        {enterpriseIcon === 'x' && <XIcon className="h-5 w-5" />}
        {!enterpriseIcon && enterpriseContent}
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

      <Container
        slotProps={{ root: { className: 'sticky top-16 bg-black py-4' } }}
        className="grid auto-cols-fr grid-flow-col content-start gap-6"
      >
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
      </Container>

      <Container className="grid auto-rows-auto items-start gap-8">
        <section className="mt-4">
          <h3 className="py-4 text-xl">Database</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Postgres"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Size"
              freeContent="500 MB"
              proContent="10 GB"
              enterpriseContent="Up to 5 TB"
            />

            <PricingListItem
              title="Per extra 10 GB"
              freeIcon="x"
              proContent="$20"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Custom API requests"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Event triggers"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Always available"
              freeContent="Sleep after 7 days of inactivity"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Backups"
              freeIcon="x"
              proContent="7 days"
              enterpriseContent="Custom"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">GraphQL</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Hasura GraphQL Engine"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Role based authorization"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Realtime subscriptions"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Authentication</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Users"
              freeContent={new Intl.NumberFormat().format(10000)}
              proContent={new Intl.NumberFormat().format(100000)}
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Email / Password"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Magic Link"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Social OAuth providers"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Storage</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Size"
              freeContent="1 GB"
              proContent="25 GB"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Per extra 10 GB"
              freeIcon="x"
              proContent="$1"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Image transformation"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Global CDN"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Functions</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Execution"
              freeContent="1 GB-hours"
              proContent="10 GB-hours"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Execution time"
              freeContent="10 sec"
              proContent="60 sec"
              enterpriseContent="900 sec"
            />

            <PricingListItem
              title="Max per deployment"
              freeContent="10 functions"
              proContent="50 functions"
              enterpriseContent="Custom"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Network</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Transfer available"
              freeContent="5 GB"
              proContent="50 GB"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Per extra 100 GB"
              freeIcon="x"
              proContent="$20"
              enterpriseContent="Custom"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Email</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Custom SMTP settings"
              freeIcon="x"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Custom branded templates"
              freeIcon="x"
              proIcon="check"
              enterpriseIcon="check"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Platform</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="HTTPS/SSL by default"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Custom backend domain"
              freeIcon="x"
              proContent={
                <span className="text-white text-opacity-20">Coming soon</span>
              }
              enterpriseContent={
                <span className="text-white text-opacity-20">Coming soon</span>
              }
            />

            <PricingListItem
              title="Auto scaling"
              freeIcon="x"
              proIcon="x"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="99.5 uptime SLA"
              freeIcon="x"
              proIcon="x"
              enterpriseContent={
                <span className="text-white text-opacity-20">Coming soon</span>
              }
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Support</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Community"
              freeIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Email"
              freeIcon="x"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="24x7x365 support with SLA"
              freeIcon="x"
              proIcon="x"
              enterpriseIcon="check"
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
