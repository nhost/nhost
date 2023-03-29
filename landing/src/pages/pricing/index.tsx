import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { ArrowUpDownIcon } from '@/components/common/icons/ArrowUpDownIcon'
import { CheckmarkCircleIcon } from '@/components/common/icons/CheckmarkCircleIcon'
import { XIcon } from '@/components/common/icons/XIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { Link } from '@/components/common/Link'
import { SectionHeading } from '@/components/common/SectionHeading'
import { PlanSelector } from '@/components/pricing/PlanSelector'
import { Transition } from '@headlessui/react'
import { Fragment, ReactElement, ReactNode, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { twMerge } from 'tailwind-merge'

function PricingListItem({
  title,
  selectedPlan,
  starterContent,
  proContent,
  enterpriseContent,
  starterIcon,
  proIcon,
  enterpriseIcon,
}: {
  title: ReactNode
  selectedPlan?: 'starter' | 'pro' | 'enterprise'
  starterContent?: ReactNode
  proContent?: ReactNode
  enterpriseContent?: ReactNode
  starterIcon?: 'check' | 'x'
  proIcon?: 'check' | 'x'
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
          selectedPlan !== 'starter' && 'hidden',
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
          selectedPlan !== 'pro' && 'hidden',
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
          !enterpriseIcon && 'text-opacity-65',
          'lg:inline',
          selectedPlan !== 'enterprise' && 'hidden',
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
  const [planSelectorVisible, setPlanSelectorVisible] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<
    'starter' | 'pro' | 'enterprise'
  >('starter')
  const { ref, inView } = useInView({ threshold: 0.5 })

  return (
    <>
      <Transition
        show={planSelectorVisible}
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PlanSelector
          onSelect={setSelectedPlan}
          onClose={() => setPlanSelectorVisible(false)}
          selectedPlan={selectedPlan}
        />
      </Transition>

      <Container
        component="section"
        className="relative flex max-w-5xl pt-20 pb-4 lg:pt-28 lg:pb-12"
      >
        <LineGrid
          className="top-5 left-0 right-0 mx-auto h-32 w-32 translate-x-0 scale-100 lg:top-16 lg:h-40 lg:w-40"
          slotProps={{ image: { className: 'mx-auto' } }}
          priority
        />
        <Glow className="top-5 h-32 w-32 bg-opacity-50 blur-3xl lg:top-16" />
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

      <div className="sticky-anchor relative h-5 w-full" ref={ref} />

      <Container
        slotProps={{
          root: { className: 'sticky top-0 bg-black block md:hidden' },
        }}
        className="grid grid-cols-2 items-center justify-between gap-4 pt-18 pb-4"
      >
        <h2 className="font-mona text-2xl capitalize">{selectedPlan}</h2>

        <Button
          variant="borderless"
          className="justify-self-end font-normal text-white text-opacity-65"
          size="xs"
          onClick={() => setPlanSelectorVisible(true)}
        >
          Switch Plan <ArrowUpDownIcon />
        </Button>

        {inView && (
          <>
            {selectedPlan === 'starter' && (
              <Button className="col-span-2 justify-center text-center">
                Start for free <ArrowRightIcon />
              </Button>
            )}

            {selectedPlan === 'pro' && (
              <Button
                className="col-span-2 justify-center text-center"
                href="https://app.nhost.io/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                Buy Pro
              </Button>
            )}

            {selectedPlan === 'enterprise' && (
              <Button
                variant="borderless"
                className="col-span-2"
                href="mailto:hello@nhost.io"
              >
                Contact Us
              </Button>
            )}
          </>
        )}

        {!inView && (
          <div className="absolute bottom-0 left-5 right-5 mx-auto h-px bg-divider" />
        )}
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

        {!inView && (
          <div className="absolute bottom-0 left-5 right-5 mx-auto h-px bg-divider" />
        )}
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
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Size"
              starterContent="500 MB"
              proContent="10 GB"
              enterpriseContent="Up to 5 TB"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Per extra 10 GB"
              starterIcon="x"
              proContent="$20"
              enterpriseContent="Custom"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Custom API requests"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Event triggers"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Always available"
              starterContent="Sleep after 7 days of inactivity"
              proIcon="check"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Backups"
              starterIcon="x"
              proContent="7 days"
              enterpriseContent="Custom"
              selectedPlan={selectedPlan}
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
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Role based authorization"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Realtime subscriptions"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
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
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Email / Password"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Magic Link"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Social OAuth providers"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
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
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Per extra 10 GB"
              starterIcon="x"
              proContent="$1"
              enterpriseContent="Custom"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Image transformation"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Global CDN"
              starterIcon="check"
              proIcon="check"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
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
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Execution time"
              starterContent="10 sec"
              proContent="60 sec"
              enterpriseContent="900 sec"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Max per deployment"
              starterContent="10 functions"
              proContent="50 functions"
              enterpriseContent="Custom"
              selectedPlan={selectedPlan}
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
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Per extra 100 GB"
              starterIcon="x"
              proContent="$20"
              enterpriseContent="Custom"
              selectedPlan={selectedPlan}
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
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Custom branded templates"
              starterIcon="x"
              proIcon="check"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
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
              selectedPlan={selectedPlan}
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
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Auto scaling"
              starterIcon="x"
              proIcon="x"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="99.5 uptime SLA"
              starterIcon="x"
              proIcon="x"
              enterpriseContent={
                <span className="text-white text-opacity-30">Coming soon</span>
              }
              selectedPlan={selectedPlan}
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
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="Email"
              starterIcon="x"
              proIcon="check"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
            />

            <PricingListItem
              title="24x7x365 support with SLA"
              starterIcon="x"
              proIcon="x"
              enterpriseIcon="check"
              selectedPlan={selectedPlan}
            />
          </ul>
        </section>

        <section className="mx-auto mt-16 grid max-w-5xl grid-flow-row gap-16 lg:mt-24">
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

              <p className="text-base">
                Yes. When creating a project, you will be asked about which plan
                you want for your backend.
              </p>
            </li>
            <li className="grid grid-flow-row gap-4 py-6">
              <h3 className="text-xl">
                How many free Starter projects can I have?
              </h3>

              <p className="text-base">
                You can have maximum 1 Starter project.
              </p>
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
                Yes. You have full access to your database and the storage. If
                you decide to leave and want to export all your data, we will
                help you. Nhost has no vendor lock-in.
              </p>
            </li>
            <li className="grid grid-flow-row gap-4 py-6">
              <h3 className="text-xl">What happens if I exceed the limits?</h3>

              <p className="text-base">
                We never shut down service without warning. Your project will
                continue to work, and we will contact you and resolve the
                situation.
              </p>
            </li>
            <li className="grid grid-flow-row gap-4 py-6">
              <h3 className="text-xl">
                How does payment get made for the Nhost paid plans?
              </h3>

              <p className="text-base">
                For Starter plan, payment is made by Stripe on a monthly basis.
                For Enterprise plan, payment is made by Stripe on a monthly
                basis, however, this can also be discussed to accommodate
                procurement processes.
              </p>
            </li>
          </ul>
        </section>
      </Container>
    </>
  )
}

PricingPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
