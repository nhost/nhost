import { Button } from '@/components/Button'
import { Container } from '@/components/Container'
import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon'
import { Layout } from '@/components/Layout'
import Image from 'next/image'
import { ReactElement } from 'react'

export default function NotFoundPage() {
  return (
    <Container
      className="relative grid h-full max-w-full grid-flow-row items-center justify-center pt-25 pb-4"
      slotProps={{ root: { className: 'h-full' } }}
    >
      <div className="mx-auto max-w-[1440px] lg:w-full">
        <Image
          src="/404.svg"
          width={1504}
          height={666}
          alt="The number 404 with some overlay"
          priority
          className="h-auto w-full"
        />
      </div>

      <div className="mx-auto -mt-[100px] grid grid-flow-row gap-4 text-center sm:-mt-[200px] lg:-mt-[350px]">
        <h1 className="font-mona text-4xl font-semibold">Page Not Found</h1>

        <p className="text-xl text-white text-opacity-65">
          This page does not exist.
        </p>

        <Button className="mt-2 justify-self-center" href="/">
          <ArrowLeftIcon /> Go back home
        </Button>
      </div>
    </Container>
  )
}

NotFoundPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
