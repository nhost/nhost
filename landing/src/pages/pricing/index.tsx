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
          {/* Plan Header Start */}
          <div className="flex flex-col space-y-4 ">
            <div className="flex flex-row justify-between">
              <h2 className="font-mona text-2xl font-semibold">Starter</h2>
            </div>

            <h2 className="font-normal text-white text-opacity-65">
              Get your idea off the ground for free. Limited to 1 project.
            </h2>
          </div>

        <div className="flex flex-col items-start">
          <div className="flex flex-row items-center space-x-2">
            <h2 className="font-mona text-2xl font-semibold">$0</h2>
            <h2 className="mt-1 font-normal text-white text-opacity-65">
              / month
            </h2>
          </div>
          <p className="text-xs text-white text-opacity-65">
            Limited to 1 member
          </p>
        </div>

          {/* Plan Header End */}
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
            subFeatures={[
              {
                title: '1 GB included',
              },
            ]}
          />

          <PricingFeature
            feature="Hasura GraphQL"
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
              {
                title: 'Role based authorization',
              },
              {
                title: 'Realtime subscriptions',
              },
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
              {
                title: 'Email / Password',
              },
              {
                title: 'Magic Link',
              },
              {
                title: 'Social OAuth providers',
              },
            ]}
          />

          <PricingFeature
            feature="Storage"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/storage.svg"
                  width={20}
                  height={20}
                  alt="A file icon"
                />
              </ProductIcon>
            }
            subFeatures={[
              {
                title: '1 GB included',
              },
              {
                title: 'Image transformation',
              },
              {
                title: 'Global CDN',
              },
            ]}
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
              {
                title: '10 included',
              },
              {
                title: '1 hour of execution time included',
              },
              {
                title: '10 sec timeout',
              },
            ]}
          />

          <PricingFeature
            feature="Network Egress"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/egress.svg"
                  width={20}
                  height={20}
                  alt="Egress icon"
                />
              </ProductIcon>
            }
            subFeatures={[{ title: '5 GB included' }]}
          />

          <PricingFeature
            feature="Platform"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/platform.svg"
                  width={20}
                  height={20}
                  alt="Egress icon"
                />
              </ProductIcon>
            }
            subFeatures={[{ title: 'Custom domains', enabled: false }, {title: 'Run your own containers', enabled: false}]}
          />


          <PricingFeature
            feature="Support"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/platform.svg"
                  width={20}
                  height={20}
                  alt="Egress icon"
                />
              </ProductIcon>
            }
            subFeatures={[{ title: 'Community', enabled: true }]}
          />

          {/* Plan details end */}
          {/* Call to action start */}
          <Button
            href="https://app.nhost.io/new"
            rel="noopener noreferrer"
            target="_blank"
            className="col-span-2 w-full justify-center text-center"
          >
            Get Started <ArrowRightIcon />
          </Button>
          {/* Call to action end */}
        </div>

        {/* Pro plan */}
        <div className="flex w-full max-w-[500px] flex-col self-start rounded-md bg-brand-main p-1">
          <span className="px-8 py-4">Most Popular</span>
          <div className="space-y-8 overflow-hidden rounded-md border border-divider bg-black p-8">
            {/* Plan Header Start */}
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
                <p className="text-xs text-white text-opacity-65">
                  3 members included / $20 per additional member, up to 10 members
                </p>
              </div>
            </div>
            {/* Plan Header End */}


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
              subFeatures={[
                {
                  title: '10 GB included, then $0.20 per GB',
                },
                {
                  title: '7 days Backups',
                },
              ]}
            />
            <PricingFeature
              feature="Hasura GraphQL"
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
                {
                  title: 'Role based authorization',
                },
                {
                  title: 'Realtime subscriptions',
                },
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
                {
                  title: 'Email / Password',
                },
                {
                  title: 'Magic Link',
                },
                {
                  title: 'Social OAuth providers',
                },
              ]}
            />
            <PricingFeature
              feature="Storage"
              featureIcon={
                <ProductIcon className="h-8 w-8">
                  <Image
                    src="/products/storage.svg"
                    width={20}
                    height={20}
                    alt="A file icon"
                  />
                </ProductIcon>
              }
              subFeatures={[
                {
                  title: '50 GB included, then $0.05 per GB',
                },
                {
                  title: 'Image transformation',
                },
                {
                  title: 'Global CDN',
                },
              ]}
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
                {
                  title: '50 included, then $5 per additional 50',
                },
                {
                  title:
                    '10 hours of execution time included, then $0.18 per additional hour (billed per second)',
                },
                {
                  title: '60 sec timeout',
                },
              ]}
            />

            <PricingFeature
              feature="Network Egress"
              featureIcon={
                <ProductIcon className="h-8 w-8">
                  <Image
                    src="/products/egress.svg"
                    width={20}
                    height={20}
                    alt="Egress icon"
                  />
                </ProductIcon>
              }
              subFeatures={[
                {
                  title: '50 GB included, then $0.10 per GB',
                },
              ]}
            />

            <PricingFeature
              feature="Platform"
              featureIcon={
                <ProductIcon className="h-8 w-8">
                  <Image
                    src="/products/platform.svg"
                    width={20}
                    height={20}
                    alt="Egress icon"
                  />
                </ProductIcon>
              }
              subFeatures={[
                {
                  title: 'Custom domains ($10 add-on)',
                },
                {
                  title: 'Run your own containers'
                }
              ]}
            />

          <PricingFeature
            feature="Support"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/platform.svg"
                  width={20}
                  height={20}
                  alt="Egress icon"
                />
              </ProductIcon>
            }
            subFeatures={[{ title: 'Community', enabled: true }, {title: 'Email', enabled: true}]}
          />

            {/* Call to action start */}
            <Button
              className="w-full justify-center text-center"
              href="https://app.nhost.io/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Started <ArrowRightIcon />
            </Button>
            {/* Call to action end */}
          </div>
        </div>

        {/* Teams plan  */}
        <div className="mt-14 w-full max-w-[500px] space-y-8 self-start overflow-hidden rounded-md border border-divider p-8">
          {/* Plan Header Start */}
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
                <p className="text-xs text-white text-opacity-65">
                  10 members included / $20 per additional member, up to 20 members
                  Unlimited members
                </p>
              </div>
          </div>
          {/* Plan Header End */}


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
              subFeatures={[
                {
                  title: '10 GB included, then $0.20 per GB',
                },
                {
                  title: '7 days Backups',
                },
              ]}
            />
            <PricingFeature
              feature="Hasura GraphQL"
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
                {
                  title: 'Role based authorization',
                },
                {
                  title: 'Realtime subscriptions',
                },
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
                {
                  title: 'Email / Password',
                },
                {
                  title: 'Magic Link',
                },
                {
                  title: 'Social OAuth providers',
                },
              ]}
            />
            <PricingFeature
              feature="Storage"
              featureIcon={
                <ProductIcon className="h-8 w-8">
                  <Image
                    src="/products/storage.svg"
                    width={20}
                    height={20}
                    alt="A file icon"
                  />
                </ProductIcon>
              }
              subFeatures={[
                {
                  title: '50 GB included, then $0.05 per GB',
                },
                {
                  title: 'Image transformation',
                },
                {
                  title: 'Global CDN',
                },
              ]}
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
                {
                  title: '50 included, then $5 per additional 50',
                },
                {
                  title:
                    '10 hours of execution time included, then $0.18 per additional hour (billed per second)',
                },
                {
                  title: '60 sec timeout',
                },
              ]}
            />

            <PricingFeature
              feature="Network Egress"
              featureIcon={
                <ProductIcon className="h-8 w-8">
                  <Image
                    src="/products/egress.svg"
                    width={20}
                    height={20}
                    alt="Egress icon"
                  />
                </ProductIcon>
              }
              subFeatures={[
                {
                  title: '50 GB included, then $0.10 per GB',
                },
              ]}
            />

            <PricingFeature
              feature="Platform"
              featureIcon={
                <ProductIcon className="h-8 w-8">
                  <Image
                    src="/products/platform.svg"
                    width={20}
                    height={20}
                    alt="Egress icon"
                  />
                </ProductIcon>
              }
              subFeatures={[
                {
                  title: 'Custom domains ($10 add-on)',
                },
                {
                  title: 'Run your own containers'
                }
              ]}
            />

          <PricingFeature
            feature="Support"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/platform.svg"
                  width={20}
                  height={20}
                  alt="Egress icon"
                />
              </ProductIcon>
            }
            subFeatures={[{ title: 'Community', enabled: true }, {title: 'Email', enabled: true}, {title: 'Dedicated Chat', enabled: true }, {title: 'SLAs'}]}
          />

          {/* Plan details end */}
          {/* Call to action start */}
          <Button
            href="https://app.nhost.io/new"
            rel="noopener noreferrer"
            target="_blank"
            className="col-span-2 w-full justify-center text-center"
          >
            Get Started <ArrowRightIcon />
          </Button>
          {/* Call to action end */}
        </div>
        {/* Enterprise plan */}
        <div className="w-full max-w-[500px] space-y-8 self-start overflow-hidden rounded-md border border-divider p-8 md:mt-14">
          {/* Plan Header Start */}

          <div className="flex flex-col space-y-4 ">
            <h2 className="font-mona text-2xl font-semibold">Enterprise</h2>

            <h2 className="font-normal text-white text-opacity-65">
              Ideal for specific infrastructure and customization needs.
            </h2>
            <span className="font-normal text-xs text-white text-opacity-85">
              Dedicated clusters available as an add-on. 
            </span>


            <div className="flex flex-row items-center space-x-2">
              <h2 className="font-mona text-2xl font-semibold">Contact us</h2>
            </div>
          </div>

          {/* Plan Header End */}


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
            subFeatures={[
              { title: 'Custom' },
              { title: 'Custom' },
            ]}
          />

          <PricingFeature
            feature="Hasura GraphQL"
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
              { title: 'Role based authorization' },
              { title: 'Realtime subscriptions' },
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
              { title: 'Email / Password' },
              { title: 'Magic Link' },
              { title: 'Social OAuth providers' },
            ]}
          />

          <PricingFeature
            feature="Storage"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/storage.svg"
                  width={20}
                  height={20}
                  alt="A file icon"
                />
              </ProductIcon>
            }
            subFeatures={[
              { title: 'Custom' },
              { title: 'Image transformation' },
              { title: 'Global CDN' },
            ]}
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
              { title: 'Custom' },
              { title: 'Custom' },
              { title: '600 sec timeout' },
            ]}
          />

          <PricingFeature
            feature="Network Egress"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/egress.svg"
                  width={20}
                  height={20}
                  alt="Egress icon"
                />
              </ProductIcon>
            }
            subFeatures={[{ title: 'Custom' }]}
          />

          <PricingFeature
            feature="Platform"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/platform.svg"
                  width={20}
                  height={20}
                  alt="Egress icon"
                />
              </ProductIcon>
            }
            subFeatures={[{ title: 'Custom domains' }, { title: 'Run your own containers'}]}
          />

          <PricingFeature
            feature="Support"
            featureIcon={
              <ProductIcon className="h-8 w-8">
                <Image
                  src="/products/platform.svg"
                  width={20}
                  height={20}
                  alt="Egress icon"
                />
              </ProductIcon>
            }
            subFeatures={[{title: 'Enterprise'}, { title: 'Community', enabled: true }, {title: 'Email', enabled: true}, {title: 'Dedicated Chat', enabled: true }, {title: 'SLAs'}, {title: 'Security Questionnaires'}, {title: 'On boarding'}]}
          />
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
