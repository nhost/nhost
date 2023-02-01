import { Button } from '@/components/Button'
import { Layout } from '@/components/Layout'
import Image from 'next/image'
import { ReactElement } from 'react'

export default function NotFoundPage() {
  return (
    <div className="relative">
      <Image
        src="/404.png"
        width={1440}
        height={529}
        alt="The number 404 with some overlay"
        priority
        className="mx-auto h-auto w-full"
      />

      <div className="absolute top-80 left-0 right-0 mx-auto grid grid-flow-row gap-4 text-center">
        <h1 className="font-mona text-4xl font-semibold">Page Not Found</h1>

        <p className="text-xl text-white text-opacity-60">
          This page does not exist.
        </p>

        <Button className="justify-self-center">Go back home</Button>
      </div>
    </div>
  )
}

NotFoundPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
