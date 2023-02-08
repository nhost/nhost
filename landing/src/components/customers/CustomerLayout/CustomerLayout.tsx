import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowLeftIcon } from '@/components/common/icons/ArrowLeftIcon'
import { CheckmarkCircleIcon } from '@/components/common/icons/CheckmarkCircleIcon'
import { XCircleIcon } from '@/components/common/icons/XCircleIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { Link } from '@/components/common/Link'
import { Customer } from '@/utils/types'
import Image from 'next/image'
import { MDXProvider } from '@mdx-js/react'
import { PropsWithChildren } from 'react'

const components = {
  img: (props: any) => <img {...props} />,
}

export interface CustomerLayout {
  /**
   * Customer to render.
   */
  customer: Customer
}

export default function CustomerLayout({
  children,
  customer,
}: PropsWithChildren<CustomerLayout>) {
  return (
    <Layout
      slotProps={{
        nextSeo: {
          openGraph: {
            images: [
              {
                url: `https://nhost.io/${customer.ogImage.src}`,
                alt: `Customer Case Study for ${customer.name} using Nhost`,
                width: customer.ogImage.width,
                height: customer.ogImage.height,
              },
            ],
          },
        },
      }}
    >
      <Container
        component="section"
        className="grid grid-cols-6 gap-6 gap-y-10 py-10"
      >
        <div className="col-span-6">
          <Link href="/customers" className="text-opacity-100">
            <ArrowLeftIcon /> Back to Customers
          </Link>
        </div>

        <div className="order-2 col-span-6 grid grid-flow-row content-start gap-8 md:order-1 md:col-span-4">
          <h1 className="hidden text-4.5xl font-bold md:block">
            {customer.name}
          </h1>

          <div className="relative grid grid-flow-row gap-6">
            <div className="relative grid grid-flow-row gap-6">
              <Image
                src="/common/dashed-line.svg"
                width={1}
                height={386}
                alt="A dashed line with a gradient background"
                className="absolute left-2 z-0 h-full w-px object-none"
                loading="eager"
              />

              <div className="relative z-10 grid grid-flow-row gap-2">
                <div className="grid grid-flow-col items-center justify-start gap-4 bg-black">
                  <XCircleIcon className="h-4 w-4" />

                  <span className="text-base">Problem</span>
                </div>
                <p className="ml-8 text-base text-white text-opacity-65">
                  {customer.problem}
                </p>
              </div>

              <div className="relative z-10 grid grid-flow-row gap-2">
                <div className="grid grid-flow-col items-center justify-start gap-4 bg-black">
                  <CheckmarkCircleIcon className="h-4 w-4" />

                  <span className="text-base">Solution</span>
                </div>
                <p className="ml-8 text-base text-white text-opacity-65">
                  {customer.solution}
                </p>
              </div>
            </div>

            <div className="prose prose-invert max-w-prose text-white text-opacity-65">
              <MDXProvider components={components}>{children}</MDXProvider>
            </div>
          </div>
        </div>

        <div className="order-1 col-span-6 grid grid-flow-row content-start gap-6 md:order-2 md:col-span-2">
          <h1 className="block text-3.5xl font-bold md:hidden">
            {customer.name}
          </h1>

          <div className="relative">
            <Glow className="top-1/2 h-full w-full -translate-y-1/2 skew-x-6 skew-y-3 bg-opacity-30 blur-[32px]" />
            <LineGrid className="h-[135%] w-[135%] -translate-x-1/4 -translate-y-[17.5%] overflow-hidden" />
            <div className="relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-divider bg-black px-18 py-14">
              <Image
                src={customer.logo.src}
                width={customer.logo.width}
                height={customer.logo.height}
                alt={customer.name}
                className="h-auto w-full max-w-[140px]"
                priority
              />
            </div>
          </div>

          <div className="grid grid-flow-row divide-y divide-divider rounded-xl border border-divider px-6 text-base">
            <div className="grid grid-cols-2 items-center gap-4 py-6">
              <span>Industry</span>
              <span className="text-white text-opacity-65">
                {customer.industry}
              </span>
            </div>

            <div className="grid grid-cols-2 items-center gap-4 py-6">
              <span>Location</span>

              <span className="text-white text-opacity-65">
                {customer.location}
              </span>
            </div>

            <div className="grid grid-cols-2 items-center gap-4 py-6">
              <span>Time To Production</span>

              <span className="text-white text-opacity-65">
                {customer.timeToProduction}
              </span>
            </div>
          </div>
        </div>
      </Container>
    </Layout>
  )
}
