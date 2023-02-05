import { Container } from '@/components/common/Container'
import { Layout } from '@/components/common/Layout'
import { Customer } from '@/utils/types'
import glob from 'fast-glob'
import Link from 'next/link'
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
        className="relative max-w-5xl pt-8 pb-16 lg:pt-28 lg:pb-28"
      >
        <div>
          <h1>Companies building with Nhost</h1>
          <div>Learn why companies are using Nhost to build.</div>
        </div>
        {customers.map((customer) => {
          return (
            <div key={customer.name}>
              <div>{customer.name}</div>
              <div>{customer.description}</div>
              <Link href={`/customers/${customer.slug}`}>Read more</Link>
            </div>
          )
        })}
        <div>Ready to try Nhost?</div>
      </Container>
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
