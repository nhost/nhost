import { Container } from '@/components/Container'
import { Layout } from '@/components/Layout'
import { ReactElement } from 'react'

export default function IndexPage() {
  return (
    <>
      <Container component="section">Hero</Container>
    </>
  )
}

IndexPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
