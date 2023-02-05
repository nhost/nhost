import { Container } from '@/components/common/Container'
import { ArrowLeftIcon } from '@/components/common/icons/ArrowLeftIcon'
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
  console.log('customer layout render')
  console.log(customer)

  return (
    <Layout
      slotProps={{
        nextSeo: {
          openGraph: {
            images: [
              {
                url: `https://nhost.io/${customer.ogImage}`,
                alt: `Customer Case Study for ${customer.name} using Nhost`,
                width: 1920,
                height: 1080,
              },
            ],
          },
        },
      }}
    >
      <Container className="py-10">
        <Link href="/customers" className="text-opacity-100">
          <ArrowLeftIcon /> Customers
        </Link>

        <div className="grid grid-cols-2">
          <div>
            <div>Problem: {customer.problem}</div>
            <div>Solution: {customer.solution}</div>
            <div>{children}</div>
          </div>
          <div>
            <div>
              <Image
                src={customer.logo}
                width={168}
                height={40}
                alt={customer.name}
              />
            </div>
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
      </Container>
    </Layout>
  )
}
