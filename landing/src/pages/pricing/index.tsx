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
import { ReactElement, ReactNode, useState } from 'react'
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
        {starterIcon === 'check' && <CheckmarkCircleIcon className="h-5 w-5" />}
        {starterIcon === 'x' && <XIcon className="h-5 w-5" />}
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
        {proIcon === 'check' && <CheckmarkCircleIcon className="h-5 w-5" />}
        {proIcon === 'x' && <XIcon className="h-5 w-5" />}
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
          <CheckmarkCircleIcon className="h-5 w-5" />
        )}
        {enterpriseIcon === 'x' && <XIcon className="h-5 w-5" />}
        {!enterpriseIcon && enterpriseContent}
      </span>
    </li>
  )
}

function PlanSelector({
  onSelect,
  onClose,
  selectedPlan,
}: {
  onSelect: (plan: 'starter' | 'pro' | 'enterprise') => void
  onClose: VoidFunction
  selectedPlan: 'starter' | 'pro' | 'enterprise'
}) {
  return (
    <div
      className="fixed top-0 bottom-0 left-0 right-0 z-50 h-full w-full bg-black bg-opacity-[1%] backdrop-blur-md lg:hidden"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 right-0 left-0 grid w-full grid-flow-row gap-2 rounded-t-lg border border-divider bg-black p-4 motion-safe:animate-slide-up"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          variant="borderless"
          className="justify-between font-mona text-2xl"
          size="sm"
          onClick={() => {
            onSelect('starter')
            onClose()
          }}
        >
          Starter {selectedPlan === 'starter' && <CheckmarkCircleIcon />}
        </Button>
        <div className="h-px w-full bg-divider" />
        <Button
          variant="borderless"
          className="justify-between font-mona text-2xl"
          size="sm"
          onClick={() => {
            onSelect('pro')
            onClose()
          }}
        >
          Pro {selectedPlan === 'pro' && <CheckmarkCircleIcon />}
        </Button>
        <div className="h-px w-full bg-divider" />
        <Button
          variant="borderless"
          className="justify-between font-mona text-2xl"
          size="sm"
          onClick={() => {
            onSelect('enterprise')
            onClose()
          }}
        >
          Enterprise {selectedPlan === 'enterprise' && <CheckmarkCircleIcon />}
        </Button>
      </div>
    </div>
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
      {planSelectorVisible && (
        <PlanSelector
          onSelect={setSelectedPlan}
          onClose={() => setPlanSelectorVisible(false)}
          selectedPlan={selectedPlan}
        />
      )}

      <Container
        component="section"
        className="relative flex max-w-5xl pt-20 pb-4 lg:pt-28 lg:pb-12"
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

        {selectedPlan === 'starter' && (
          <Button className="col-span-2 justify-center text-center">
            Start for free <ArrowRightIcon />
          </Button>
        )}

        {selectedPlan === 'pro' && (
          <p className="col-span-2 px-6 py-3 text-center">Buy Pro</p>
        )}
        {selectedPlan === 'enterprise' && (
          <Link
            className="col-span-2 justify-center px-6 py-3 text-opacity-100"
            href="mailto:hello@nhost.io"
          >
            Contact Us
          </Link>
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
            subtitle={inView && 'Free forever'}
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
            subtitle={inView && '$25/mo'}
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
            subtitle={inView && 'Custom plan'}
            className="gap-2"
            slotProps={{
              title: { className: 'text-3xl md:text-3xl' },
              subtitle: { className: 'text-base' },
            }}
          />

          <Link
            className="justify-center px-6 py-3 text-opacity-100"
            href="mailto:hello@nhost.io"
          >
            Contact Us
          </Link>
        </div>

        {!inView && (
          <div className="absolute bottom-0 left-5 right-5 mx-auto h-px bg-divider" />
        )}
      </Container>

      <Container className="grid auto-rows-auto items-start gap-8">
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
                <span className="text-white text-opacity-20">Coming soon</span>
              }
              enterpriseContent={
                <span className="text-white text-opacity-20">Coming soon</span>
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
                <span className="text-white text-opacity-20">Coming soon</span>
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
      </Container>
    </>
  )
}

PricingPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
