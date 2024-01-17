import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { Link } from '@/components/common/Link'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import { CheckmarkCircleIcon } from '@/components/common/icons/CheckmarkCircleIcon'

import { PricingFeature } from '@/components/pricing/PricingFeature'
import { Tooltip } from '@/components/common/Tooltip'
import Image from 'next/image'
import { ReactElement, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { XIcon } from '@/components/common/icons/XIcon'

function PricingListItem({
  title,
  starterContent,
  proContent,
  teamContent,
  enterpriseContent,
  starterIcon,
  proIcon,
  teamIcon,
  enterpriseIcon,
}: {
  title: ReactNode
  starterContent?: ReactNode
  proContent?: ReactNode
  teamContent?: ReactNode
  enterpriseContent?: ReactNode
  starterIcon?: 'check' | 'x'
  proIcon?: 'check' | 'x'
  teamIcon?: 'check' | 'x'
  enterpriseIcon?: 'check' | 'x'
}) {
  return (
    <li className="grid auto-cols-fr grid-flow-col gap-6 py-4">
      <span className="col-span-5 text-white text-opacity-65">{title}</span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-center text-white',
          !starterIcon && 'text-opacity-65',
          'lg:inline',
        )}
      >
        {starterIcon === 'check' && (
          <CheckmarkCircleIcon className="mx-auto h-5 w-5" />
        )}
        {starterIcon === 'x' && <XIcon className="mx-auto h-5 w-5" />}
        {!starterIcon && starterContent}
      </span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-center text-white',
          !proIcon && 'text-opacity-65',
          'lg:inline',
        )}
      >
        {proIcon === 'check' && (
          <CheckmarkCircleIcon className="mx-auto h-5 w-5" />
        )}
        {proIcon === 'x' && <XIcon className="mx-auto h-5 w-5" />}
        {!proIcon && proContent}
      </span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-center text-white',
          !proIcon && 'text-opacity-65',
          'lg:inline',
        )}
      >
        {proIcon === 'check' && (
          <CheckmarkCircleIcon className="mx-auto h-5 w-5" />
        )}
        {teamIcon === 'x' && <XIcon className="mx-auto h-5 w-5" />}
        {!teamIcon && teamContent}
      </span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-center text-white',
          !enterpriseIcon && 'text-opacity-65',
          'lg:inline',
        )}
      >
        {enterpriseIcon === 'check' && (
          <CheckmarkCircleIcon className="mx-auto h-5 w-5" />
        )}
        {enterpriseIcon === 'x' && <XIcon className="mx-auto h-5 w-5" />}
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
        className="relative flex max-w-5xl pt-20 pb-4 lg:pt-28 lg:pb-12"
      >
        <LineGrid
          className="left-0 right-0 top-5 mx-auto h-32 w-32 translate-x-0 scale-100 lg:top-16 lg:h-40 lg:w-40"
          slotProps={{ image: { className: 'mx-auto' } }}
          priority
        />
        <Glow className="top-5 h-32 w-32 bg-opacity-50 blur-3xl lg:top-16" />

        <SectionHeading
          title="Pricing"
          subtitle="Start building for free, and scale as needed"
          slotProps={{
            title: {
              component: 'h1',
              className: 'text-3.5xl md:text-5xl',
            },
          }}
          className="relative z-10"
        />
      </Container>

      <Container className="grid w-full grid-flow-row grid-cols-1 justify-items-center gap-4 pb-8 lg:grid-cols-4">
        {/* Starter plan  */}
        <div className="mt-14 w-full max-w-[500px] space-y-8 self-start overflow-hidden rounded-md border border-divider p-8">
          <div className="flex flex-col space-y-4 ">
            <div className="flex flex-row justify-between">
              <h2 className="font-mona text-2xl font-semibold">Starter</h2>
            </div>

            <h2 className="font-normal text-white text-opacity-65">
              Get your idea off the ground for free.
            </h2>
          </div>

          <div className="flex flex-col items-start">
            <div className="flex flex-row items-center space-x-2">
              <h2 className="font-mona text-2xl font-semibold">$0</h2>
              <h2 className="mt-1 font-normal text-white text-opacity-65">
                / month
              </h2>
            </div>
          </div>

          <PricingFeature
            subFeatures={[
              {
                title: '1 GB Database',
              },
              {
                title: '1 GB Storage',
              },
              {
                title: '5 GB Egress',
              },
              {
                title: 'Functions',
              },
              {
                title: 'Realtime APIs',
              },
              {
                title: 'Unlimited Users',
              },
              {
                title: 'OAuth Providers',
              },
              {
                title: 'Community Support',
              },
            ]}
          />

          <Button
            href="https://app.nhost.io/new"
            rel="noopener noreferrer"
            target="_blank"
            className="col-span-2 w-full justify-center text-center"
          >
            Get Started <ArrowRightIcon />
          </Button>
        </div>

        {/* Pro plan */}
        <div className="flex w-full max-w-[500px] flex-col self-start rounded-md bg-brand-main p-1">
          <span className="px-8 py-4">Most Popular</span>
          <div className="space-y-8 overflow-hidden rounded-md border border-divider bg-black p-8">
            <div className="flex flex-col space-y-4 ">
              <div className="flex flex-row justify-between">
                <h2 className="font-mona text-2xl font-semibold">Pro</h2>
              </div>
              <h2 className="font-normal text-white text-opacity-65">
                Well suited for production applications, scale as needed.
              </h2>

              <div className="flex flex-col items-start">
                <div className="flex flex-row items-center space-x-2">
                  <h2 className="font-mona text-2xl font-semibold">$25</h2>
                  <h2 className="mt-1 font-normal text-white text-opacity-65">
                    / month
                  </h2>
                </div>
              </div>
            </div>

            <h2 className="mt-1 font-sm text-white text-opacity-65">
              Everything in Starter plus:
            </h2>

            <PricingFeature
              subFeatures={[
                {
                  title: 'No project pausing',
                },
                {
                  title: '10GB database',
                },
                {
                  title: '50GB storage',
                },
                {
                  title: '50GB egress',
                },
                {
                  title: 'Backups stored for 7 days',
                },
                {
                  title: 'AI toolkit',
                },
                {
                  title: 'Run your own services',
                },
                {
                  title: 'Managed grafana instance',
                },
                {
                  title: 'Email support',
                },
              ]}
            />

            <Button
              className="w-full justify-center text-center"
              href="https://app.nhost.io/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Started <ArrowRightIcon />
            </Button>
          </div>
        </div>

        {/* Teams plan  */}
        <div className="mt-14 w-full max-w-[500px] space-y-8 self-start overflow-hidden rounded-md border border-divider p-8">
          <div className="flex flex-col space-y-4 ">
            <div className="flex flex-row justify-between">
              <h2 className="font-mona text-2xl font-semibold">Team</h2>
            </div>

            <h2 className="font-normal text-white text-opacity-65">
              Collaborate with added support, scale as needed.
            </h2>
            <div className="flex flex-col items-start">
              <div className="flex flex-row items-center space-x-2">
                <h2 className="font-mona text-2xl font-semibold">$599</h2>
                <h2 className="mt-1 font-normal text-white text-opacity-65">
                  / month
                </h2>
              </div>
            </div>
          </div>

          <h2 className="mt-1 font-sm text-white text-opacity-65">
            Everything in Pro plus:
          </h2>

          <PricingFeature
            subFeatures={[
              {
                title: 'Email support SLA',
              },
              {
                title: 'Dedicated discord channel',
              },
              {
                title: 'Connect to external databases',
              },
              {
                title: 'SOC2 (coming soon)',
              },
            ]}
          />

          <Button
            href="https://app.nhost.io/new"
            rel="noopener noreferrer"
            target="_blank"
            className="col-span-2 w-full justify-center text-center"
          >
            Get Started <ArrowRightIcon />
          </Button>
        </div>

        {/* Enterprise plan */}
        <div className="w-full max-w-[500px] space-y-8 self-start overflow-hidden rounded-md border border-divider p-8 md:mt-14">
          <div className="flex flex-col space-y-4 ">
            <h2 className="font-mona text-2xl font-semibold">Enterprise</h2>

            <h2 className="font-normal text-white text-opacity-65">
              Ideal for specific infrastructure and customization needs.
            </h2>

            <div className="flex flex-row items-center space-x-2">
              <h2 className="font-mona text-2xl font-semibold">Contact us</h2>
            </div>
          </div>

          <h2 className="mt-1 font-sm text-white text-opacity-65">
            Everything in Team plus:
          </h2>

          <PricingFeature subFeatures={[
            { title: 'SLAs' },
            { title: 'Dedicated Technical Account Manager' },
            { title: 'Dedicated clusters (add-on)' },
          ]} />

          <Button
            className="w-full justify-center text-center"
            href="mailto:hello@nhost.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact us <ArrowRightIcon />
          </Button>
        </div>
      </Container>

      <Container
        slotProps={{
          root: {
            className: 'sticky top-0 bg-black hidden md:block transform-cpu',
          },
        }}
        className="relative grid auto-cols-fr grid-flow-col content-start gap-6 pt-20 pb-4"
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

          <Button
            variant="borderless"
            className="justify-center text-center"
            href="https://app.nhost.io/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            Buy Pro
          </Button>
        </div>

        <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
          <SectionHeading
            title="Team"
            subtitle="$599/mo"
            className="gap-2"
            slotProps={{
              title: { className: 'text-3xl md:text-3xl' },
              subtitle: { className: 'text-base' },
            }}
          />

          <Button
            variant="borderless"
            className="justify-center text-center"
            href="https://app.nhost.io/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            Buy Team
          </Button>
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

          <Button
            variant="borderless"
            href="mailto:hello@nhost.io"
            className="justify-center"
          >
            Contact Us
          </Button>
        </div>
      </Container>

      <Container className="grid auto-rows-auto items-start gap-8 pb-28">
        <section className="mt-4">
          <h3 className="py-4 text-xl">Database</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Postgres"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Size"
              starterContent="500 MB"
              proContent="10 GB"
              enterpriseContent="Up to 5 TB"
            />

            <PricingListItem
              title="Per extra 10 GB"
              starterIcon="x"
              proContent="$20"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Custom API requests"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Event triggers"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Always available"
              starterContent="Sleep after 7 days of inactivity"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Backups"
              starterIcon="x"
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
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Role based authorization"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Realtime subscriptions"
              starterIcon="check"
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
              starterContent={new Intl.NumberFormat().format(10000)}
              proContent={new Intl.NumberFormat().format(100000)}
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Email / Password"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Magic Link"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Social OAuth providers"
              starterIcon="check"
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
              starterContent="1 GB"
              proContent="25 GB"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Per extra 10 GB"
              starterIcon="x"
              proContent="$1"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Image transformation"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Global CDN"
              starterIcon="check"
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
              starterContent="1 GB-hours"
              proContent="10 GB-hours"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Execution time"
              starterContent="10 sec"
              proContent="60 sec"
              enterpriseContent="900 sec"
            />

            <PricingListItem
              title="Max per deployment"
              starterContent="10 functions"
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
              starterContent="5 GB"
              proContent="50 GB"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Per extra 100 GB"
              starterIcon="x"
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
              starterIcon="x"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Custom branded templates"
              starterIcon="x"
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
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Custom backend domain"
              starterIcon="x"
              proContent={
                <span className="text-white text-opacity-30">Coming soon</span>
              }
              enterpriseContent={
                <span className="text-white text-opacity-30">Coming soon</span>
              }
            />

            <PricingListItem
              title="Auto scaling"
              starterIcon="x"
              proIcon="x"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="99.5 uptime SLA"
              starterIcon="x"
              proIcon="x"
              enterpriseContent={
                <span className="text-white text-opacity-30">Coming soon</span>
              }
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Support</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Community"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Email"
              starterIcon="x"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="24x7x365 support with SLA"
              starterIcon="x"
              proIcon="x"
              enterpriseIcon="check"
            />
          </ul>
        </section>
      </Container>

      <section className="col-span-3 mx-auto mt-4 grid max-w-5xl grid-flow-row gap-16 p-8">
        <SectionHeading
          title="FAQ"
          subtitle={
            <>
              Didn&apos;t find what you&apos;re looking for?{' '}
              <Link
                href="mailto:hello@nhost.io"
                className="text-white text-opacity-100"
              >
                Contact Us
              </Link>
              .
            </>
          }
        />

        <ul className="divide-y divide-divider">
          <li className="grid grid-flow-row gap-4 py-6">
            <h3 className="text-xl">Do I pick one plan per project?</h3>

            <p className="text-base">Yes, plans are per project.</p>
          </li>
          <li className="grid grid-flow-row gap-4 py-6">
            <h3 className="text-xl">
              How many free Starter projects can I have?
            </h3>

            <p className="text-base">You can have 1 Starter project.</p>
          </li>
          <li className="grid grid-flow-row gap-4 py-6">
            <h3 className="text-xl">Can I switch between plans later?</h3>

            <p className="text-base">
              Yes, you can upgrade plans at any time. To downgrade, please
              contact us at{' '}
              <Link
                href="mailto:support@nhost.io"
                className="text-opacity-100 underline"
              >
                support@nhost.io
              </Link>
              .
            </p>
          </li>
          <li className="grid grid-flow-row gap-4 py-6">
            <h3 className="text-xl">Can I export my data?</h3>

            <p className="text-base">
              Yes, you have full access to your database and storage. No vendor
              lock-in.
            </p>
          </li>
          <li className="grid grid-flow-row gap-4 py-6">
            <h3 className="text-xl">What happens if I exceed the limits?</h3>

            <p className="text-base">You will be charged for excess usage.</p>
          </li>
        </ul>
      </section>
    </>
  )
}

PricingPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
