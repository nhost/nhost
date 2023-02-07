import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { CustomerCard } from '@/components/common/CustomerCard'
import { Glow } from '@/components/common/Glow'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import { Customer } from '@/utils/types'
import glob from 'fast-glob'
import Image from 'next/image'
import * as path from 'path'
import { ReactElement } from 'react'

export interface CustomersPageProps {
  customers: Customer[]
}

export default function BlogPage({ customers }: CustomersPageProps) {
  console.log(customers)
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
          title="Companies building with Nhost"
          subtitle="Read why companies are using Nhost to build."
          slotProps={{
            title: {
              component: 'h1',
              className: 'text-3.5xl md:text-5xl md:leading-normal max-w-lg',
            },
          }}
          className="relative z-10"
        />
      </Container>

      <Container
        component="section"
        className="relative grid max-w-lg grid-cols-1 gap-6 pt-2 pb-16 sm:grid-cols-1 lg:max-w-7xl lg:grid-cols-3 lg:pt-12 lg:pb-28"
      >
        {customers.map((customer) => (
          <CustomerCard
            key={customer.name}
            title={customer.name}
            description={customer.description}
            image={
              <Image
                src={customer.logo.src}
                width={customer.logo.width}
                height={customer.logo.height}
                alt={`Logo of ${customer.name}`}
              />
            }
            href={`/customers/${customer.slug}`}
          />
        ))}
      </Container>

      <CTASection />
    </>
  )
}

BlogPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}

export async function getStaticProps() {
  // TODO: Move this function to a separate file
  const importPage = async (fileName: any) => {
    // if we change the location of this folder, make sure the path is correct!
    let { customer, default: component } = await import(`./${fileName}`)
    return {
      slug: fileName.replace(/(\/index)?\.mdx$/, ''),
      ...customer,
      component,
    }
  }

  // TODO: move this function to a separate file
  const getAllPages = async () => {
    const fileNames = await glob(['*.mdx', '*/index.mdx'], {
      cwd: path.join(process.cwd(), 'src/pages/customers'),
    })

    const customers = await Promise.all(fileNames.map(importPage))

    return customers.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
  }

  return {
    props: {
      customers: (await getAllPages()).map(
        ({ component, ...article }) => article,
      ),
    },
  }
}
