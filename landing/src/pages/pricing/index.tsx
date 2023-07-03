import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import { PlanSelector } from '@/components/pricing/PlanSelector'
import { PricingFeature } from '@/components/pricing/PricingFeature'
import { Transition } from '@headlessui/react'
import Image from 'next/image'
import { Fragment, ReactElement, useState } from 'react'

export default function PricingPage() {
  const [planSelectorVisible, setPlanSelectorVisible] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<
    'starter' | 'pro' | 'enterprise'
  >('starter')

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
          className="left-0 right-0 top-5 mx-auto h-32 w-32 translate-x-0 scale-100 lg:top-16 lg:h-40 lg:w-40"
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

      <Container className="grid grid-flow-row grid-cols-1 gap-4 pb-8 md:grid-cols-2 lg:grid-cols-3">
        {/* Starter plan  */}
        <div className="mt-14 space-y-8 overflow-hidden rounded-md border border-divider p-8">
          {/* Plan Header Start */}

          <div className="flex flex-col space-y-4 ">
            <h2 className="font-mona text-2xl font-semibold">Starter</h2>

            <h2 className="font-normal text-white text-opacity-65">
              Get you idea off the ground for free.
            </h2>

            <div className="flex flex-row justify-between">
              <div className="flex flex-row items-center space-x-2">
                <h2 className="font-mona text-2xl font-semibold">$0</h2>
                <h2 className="mt-1 font-normal text-white text-opacity-65">
                  / month
                </h2>
              </div>

              {/* todo move this color to tailwind.config.js */}
              <div className="mt-2 rounded bg-[#001D49] px-3 py-1 text-xs font-black">
                Limited to 1 project
              </div>
            </div>
          </div>

          {/* Plan Header End */}

          {/* Call to action start */}
          <Button
            href="https://app.nhost.io/signup"
            rel="noopener noreferrer"
            target="_blank"
            className="col-span-2 w-full justify-center text-center"
          >
            Start for free <ArrowRightIcon />
          </Button>
          {/* Call to action end */}

          {/* Plan details start */}
          <PricingFeature
            feature="Postgres"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/postgres.svg"
                  width={24}
                  height={24}
                  alt="Logo of Postgres"
                />
              </ProductIcon>
            }
            subFeatures={['500 MB', 'Custom API requests', 'Event Triggers']}
          />

          <PricingFeature
            feature="GraphQL"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/graphql.svg"
                  width={24}
                  height={24}
                  alt="Logo of GraphQL"
                />
              </ProductIcon>
            }
            subFeatures={[
              'Hasura',
              'Role based authorization',
              'Realtime subscriptions',
            ]}
          />

          <PricingFeature
            feature="Authentication"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/authentication.svg"
                  width={24}
                  height={24}
                  alt="A user icon"
                />
              </ProductIcon>
            }
            subFeatures={[
              '10,000 users',
              'Email / Password',
              'Magic Link',
              'Social OAuth providers',
            ]}
          />

          <PricingFeature
            feature="Storage"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/storage.svg"
                  width={24}
                  height={24}
                  alt="A file icon"
                />
              </ProductIcon>
            }
            subFeatures={['1 GB', 'Image transformation', 'Global CDN']}
          />

          <PricingFeature
            feature="Functions"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/functions.svg"
                  width={24}
                  height={24}
                  alt="Lambda icon"
                />
              </ProductIcon>
            }
            subFeatures={[
              '10 functions',
              '1 GB-hours Execution',
              '10 sec timeout',
            ]}
          />

          {/* Plan details end */}
        </div>

        {/* Pro plan */}
        <div className="flex flex-col rounded-md bg-[#0052CD] p-1">
          {' '}
          {/* todo move this color to tailwind.config.js */}
          <span className="px-8 py-4 uppercase ">most popular</span>
          <div className="space-y-8 overflow-hidden rounded-md border border-divider bg-black p-8">
            {/* Plan Header Start */}
            <div className="flex flex-col space-y-4 ">
              <h2 className="font-mona text-2xl font-semibold">Pro</h2>
              <h2 className="font-normal text-white text-opacity-65">
                For production apps.
              </h2>
              <div className="flex flex-row items-center space-x-2">
                <h2 className="font-mona text-2xl font-semibold">$25</h2>
                <h2 className="mt-1 font-normal text-white text-opacity-65">
                  / month
                </h2>
              </div>
            </div>
            {/* Plan Header End */}
            {/* Call to action start */}
            <Button
              className="w-full justify-center text-center"
              href="https://app.nhost.io/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              Buy Pro <ArrowRightIcon />
            </Button>
            {/* Call to action end */}
            {/* Plan details start */}
            <PricingFeature
              feature="Postgres"
              featureIcon={
                <ProductIcon className="h-8 w-8">
                  <Image
                    src="/products/postgres.svg"
                    width={24}
                    height={24}
                    alt="Logo of Postgres"
                  />
                </ProductIcon>
              }
              subFeatures={['10 GB', '7 days Backups', 'Always available']}
            />
            <PricingFeature
              feature="GraphQL"
              featureIcon={
                <ProductIcon className="h-8 w-8">
                  <Image
                    src="/products/graphql.svg"
                    width={24}
                    height={24}
                    alt="Logo of GraphQL"
                  />
                </ProductIcon>
              }
              subFeatures={[
                'Hasura',
                'Role based authorization',
                'Realtime subscriptions',
              ]}
            />
            <PricingFeature
              feature="Authentication"
              featureIcon={
                <ProductIcon className="h-8 w-8">
                  <Image
                    src="/products/authentication.svg"
                    width={24}
                    height={24}
                    alt="A user icon"
                  />
                </ProductIcon>
              }
              subFeatures={[
                '100,000 users',
                'Email / Password',
                'Magic Link',
                'Social OAuth providers',
              ]}
            />
            <PricingFeature
              feature="Storage"
              featureIcon={
                <ProductIcon className="h-8 w-8">
                  <Image
                    src="/products/storage.svg"
                    width={24}
                    height={24}
                    alt="A file icon"
                  />
                </ProductIcon>
              }
              subFeatures={['25 GB', 'Image transformation', 'Global CDN']}
            />
            <PricingFeature
              feature="Functions"
              featureIcon={
                <ProductIcon className="h-8 w-8">
                  <Image
                    src="/products/functions.svg"
                    width={24}
                    height={24}
                    alt="Lambda icon"
                  />
                </ProductIcon>
              }
              subFeatures={[
                '50 functions',
                '10 GB-hours Execution',
                '60 sec timeout',
              ]}
            />
          </div>
        </div>

        {/* Enterprise plan */}
        <div className="mt-14 space-y-8 overflow-hidden rounded-md border border-divider p-8">
          {/* Plan Header Start */}

          <div className="flex flex-col space-y-4 ">
            <h2 className="font-mona text-2xl font-semibold">Enterprise</h2>

            <h2 className="font-normal text-white text-opacity-65">
              For production apps.
            </h2>

            <div className="flex flex-row items-center space-x-2">
              <h2 className="font-mona text-2xl font-semibold">Custom</h2>
            </div>
          </div>

          {/* Plan Header End */}

          {/* Call to action start */}
          <Button
            className="w-full justify-center text-center"
            href="mailto:hello@nhost.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact us <ArrowRightIcon />
          </Button>
          {/* Call to action end */}

          {/* Plan details start */}
          <PricingFeature
            feature="Postgres"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/postgres.svg"
                  width={24}
                  height={24}
                  alt="Logo of Postgres"
                />
              </ProductIcon>
            }
            subFeatures={['Up to 5 TB', 'Extendable Storage', 'Custom Backups']}
          />

          <PricingFeature
            feature="GraphQL"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/graphql.svg"
                  width={24}
                  height={24}
                  alt="Logo of GraphQL"
                />
              </ProductIcon>
            }
            subFeatures={[
              'Hasura',
              'Role based authorization',
              'Realtime subscriptions',
            ]}
          />

          <PricingFeature
            feature="Authentication"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/authentication.svg"
                  width={24}
                  height={24}
                  alt="A user icon"
                />
              </ProductIcon>
            }
            subFeatures={[
              'Custom',
              'Email / Password',
              'Magic Link',
              'Social OAuth providers',
            ]}
          />

          <PricingFeature
            feature="Storage"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/storage.svg"
                  width={24}
                  height={24}
                  alt="A file icon"
                />
              </ProductIcon>
            }
            subFeatures={['Custom', 'Image transformation', 'Global CDN']}
          />

          <PricingFeature
            feature="Functions"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/functions.svg"
                  width={24}
                  height={24}
                  alt="Lambda icon"
                />
              </ProductIcon>
            }
            subFeatures={['Custom', 'Custom', '600 sec timeout']}
          />
        </div>
      </Container>
    </>
  )
}

PricingPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
