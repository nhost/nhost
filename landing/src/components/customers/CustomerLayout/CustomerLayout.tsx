import { Container } from '@/components/common/Container'
import { ArrowLeftIcon } from '@/components/common/icons/ArrowLeftIcon'
import { CheckmarkCircleIcon } from '@/components/common/icons/CheckmarkCircleIcon'
import { XCircleIcon } from '@/components/common/icons/XCircleIcon'
import { Layout } from '@/components/common/Layout'
import { Link } from '@/components/common/Link'
import { Customer } from '@/utils/types'
import Image from 'next/image'
import { PropsWithChildren } from 'react'

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
        className="grid grid-cols-5 gap-6 gap-y-10 py-10"
      >
        <div className="col-span-5">
          <Link href="/customers" className="text-opacity-100">
            <ArrowLeftIcon /> Back to Customers
          </Link>
        </div>

        <div className="col-span-3 grid grid-flow-row gap-8">
          <h1 className="text-4.5xl font-bold">{customer.name}</h1>

          <div className="grid grid-flow-row gap-6">
            <div className="grid grid-flow-row gap-2">
              <div className="grid grid-flow-col items-center justify-start gap-4">
                <XCircleIcon className="h-4 w-4" />

                <span className="text-base">Problem</span>
              </div>
              <p className="ml-8 text-base text-white text-opacity-65">
                {customer.problem}
              </p>
            </div>

            <div className="grid grid-flow-row gap-2">
              <div className="grid grid-flow-col items-center justify-start gap-4">
                <CheckmarkCircleIcon className="h-4 w-4" />

                <span className="text-base">Solution</span>
              </div>
              <p className="ml-8 text-base text-white text-opacity-65">
                {customer.problem}
              </p>
            </div>

            <div className="text-white text-opacity-65">{children}</div>
          </div>
        </div>

        <div className="col-span-2">
          <div className="grid grid-cols-2">
            <div>
              <Image
                src={customer.logo.src}
                width={customer.logo.width}
                height={customer.logo.height}
                alt={customer.name}
              />
              <div>
                <div className="flex">
                  <div>Industry:</div>
                  <div>{customer.industry}</div>
                </div>
                <div className="flex">
                  <div>Location:</div>
                  <div>{customer.location}</div>
                </div>
                <div className="flex">
                  <div>Time To Production:</div>
                  <div>{customer.timeToProduction}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Layout>
  )
}
