import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { Link } from '@/components/common/Link'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import { PricingFeature } from '@/components/pricing/PricingFeature'
import Image from 'next/image'
import { ReactElement } from 'react'

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

      <Container className="grid w-full grid-flow-row grid-cols-1 justify-items-center gap-4 pb-8 lg:grid-cols-3">
        {/* Starter plan  */}
        <div className="mt-14 w-full max-w-[500px] space-y-8 self-start overflow-hidden rounded-md border border-divider p-8">
          {/* Plan Header Start */}
          <div className="flex flex-col space-y-4 ">
            <div className="flex flex-row justify-between">
              <h2 className="font-mona text-2xl font-semibold">Starter</h2>
              <div className="flex flex-row items-center space-x-2">
                <h2 className="font-mona text-2xl font-semibold">$0</h2>
                <h2 className="mt-1 font-normal text-white text-opacity-65">
                  / month
                </h2>
              </div>
            </div>

            <h2 className="font-normal text-white text-opacity-65">
              Get your idea off the ground for free. Limited to 1 project.
            </h2>
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
        <div className="flex w-full max-w-[500px] flex-col self-start rounded-md bg-brand-main p-1">
          <span className="px-8 py-4 uppercase">most popular</span>
          <div className="space-y-8 overflow-hidden rounded-md border border-divider bg-black p-8">
            {/* Plan Header Start */}
            <div className="flex flex-col space-y-4 ">
              <div className="flex flex-row justify-between">
                <h2 className="font-mona text-2xl font-semibold">Pro</h2>
                <div className="flex flex-row items-center space-x-2">
                  <h2 className="font-mona text-2xl font-semibold">$25</h2>
                  <h2 className="mt-1 font-normal text-white text-opacity-65">
                    / month
                  </h2>
                </div>
              </div>
              <h2 className="font-normal text-white text-opacity-65">
                Well suited for production applications. Meets your needs as you
                grow.
              </h2>
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
        <div className="w-full max-w-[500px] space-y-8 self-start overflow-hidden rounded-md border border-divider p-8 md:mt-14">
          {/* Plan Header Start */}

          <div className="flex flex-col space-y-4 ">
            <h2 className="font-mona text-2xl font-semibold">Enterprise</h2>

            <h2 className="font-normal text-white text-opacity-65">
              Ideal for managing significant workloads in large-scale
              applications.
            </h2>
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

            <p className="text-base">
              Yes. When creating a project, you will be asked about which plan
              you want for your backend.
            </p>
          </li>
          <li className="grid grid-flow-row gap-4 py-6">
            <h3 className="text-xl">
              How many free Starter projects can I have?
            </h3>

            <p className="text-base">You can have maximum 1 Starter project.</p>
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
              Yes. You have full access to your database and the storage. If you
              decide to leave and want to export all your data, we will help
              you. Nhost has no vendor lock-in.
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
              For Enterprise plan, payment is made by Stripe on a monthly basis,
              however, this can also be discussed to accommodate procurement
              processes.
            </p>
          </li>
        </ul>
      </section>
    </>
  )
}

PricingPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
