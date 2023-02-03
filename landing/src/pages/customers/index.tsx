import { Container } from '@/components/common/Container'
import { Layout } from '@/components/common/Layout'
import glob from 'fast-glob'
import * as path from 'path'
import { ReactElement } from 'react'

interface Customers {
  name: string
}

export interface CustomersPageProps {
  customers: Customers[]
}

export default function BlogPage({ customers }: CustomersPageProps) {
  console.log(customers)
  return (
    <>
      <Container
        component="section"
        className="relative flex max-w-5xl pt-8 pb-16 lg:pt-28 lg:pb-28"
      >
        <div>123</div>
      </Container>
    </>
  )
}

BlogPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}

export async function getStaticProps() {
  // TODO: Move this function to a separate file
  const importArticle = async (articleFilename: any) => {
    // if we change the location of this folder, make sure the path is correct!
    let { article, default: component } = await import(`./${articleFilename}`)
    return {
      slug: articleFilename.replace(/(\/index)?\.mdx$/, ''),
      ...article,
      component,
    }
  }

  // TODO: move this function to a separate file
  const getAllArticles = async () => {
    const articleFilenames = await glob(['*.mdx', '*/index.mdx'], {
      cwd: path.join(process.cwd(), 'src/pages/customers'),
    })

    const customers = await Promise.all(articleFilenames.map(importArticle))

    return customers.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
  }

  return {
    props: {
      customers: (await getAllArticles()).map(
        ({ component, ...article }) => article,
      ),
    },
  }
}
