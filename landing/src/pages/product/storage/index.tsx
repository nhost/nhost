import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { ExampleSelectorButton } from '@/components/common/ExampleSelectorButton'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ProductSection } from '@/components/product/ProductSection'
import { StorageHeroSection } from '@/components/storage/StorageHeroSection'
import Image from 'next/image'
import { ReactElement, useState } from 'react'

const codeSnippets = {
  uploadFile: `
await nhost.storage.upload({ file })
`,
  getPublicUrl: `
nhost.storage.getPublicUrl({ fileId: 'file-id' })
`,
  getPresignedUrl: `
const { presignedUrl, error } = await nhost.storage.getPresignedUrl({
  fileId: 'file-id'
})
`,
  transformImage: `
const publicUrl = nhost.storage.getPublicUrl({
  fileId: 'file-id',
  width: 200
})
`,
}

export default function StoragePage() {
  const [selectedExample, setSelectedExample] =
    useState<keyof typeof codeSnippets>('uploadFile')

  return (
    <>
      <StorageHeroSection />

      <Container
        component="section"
        className="mt-16 grid grid-flow-row gap-16 md:mt-32 md:gap-24"
        slotProps={{
          root: { className: 'overflow-hidden xl:overflow-visible' },
        }}
      >
        <SectionHeading
          title="Add storage in minutes"
          subtitle="Rapidly build production-ready file management for web and mobile apps."
          className="max-w-xl"
          slotProps={{
            subtitle: {
              className: 'max-w-lg mx-auto',
            },
          }}
        />

        <div className="grid grid-cols-1 items-start justify-items-center gap-0 pb-12 xl:grid-cols-2 xl:justify-items-start xl:gap-6">
          <div className="order-2 w-full xl:order-1">
            <CodeSnippet
              language="typescript"
              customStyle={{ minHeight: 220 }}
              slotProps={{ root: { className: 'mx-auto md:max-w-xl' } }}
            >
              {codeSnippets[selectedExample].trim()}
            </CodeSnippet>
          </div>

          <div className="relative order-1 w-full max-w-3xl xl:order-2">
            <div className="relative z-10 grid grid-flow-col justify-around xl:justify-evenly">
              <ExampleSelectorButton
                active={selectedExample === 'uploadFile'}
                onClick={() => setSelectedExample('uploadFile')}
              >
                Upload File
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'getPublicUrl'}
                onClick={() => setSelectedExample('getPublicUrl')}
              >
                Get Public URL
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'getPresignedUrl'}
                onClick={() => setSelectedExample('getPresignedUrl')}
              >
                Get Presigned URL
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'transformImage'}
                onClick={() => setSelectedExample('transformImage')}
              >
                Transform Image
              </ExampleSelectorButton>
            </div>

            <Image
              src="/common/connectors/storage-example-connectors.svg"
              alt="Dashed lines"
              width={608}
              height={97}
              className="h-auto w-full"
            />

            <Image
              src="/common/logo-glow.svg"
              width={1220}
              height={1220}
              alt="Nhost Logo in a dark circle"
              className="absolute -top-32 left-0 right-0 z-0 mx-auto hidden h-auto w-full object-none xl:block"
            />
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 hidden lg:mt-40">
        <SectionHeading
          title="Powerful permissions, made simple"
          subtitle="Storage permissions work like any other data in your database. Use Buckets to segment files."
          className="max-w-2xl"
          slotProps={{
            subtitle: {
              className: 'max-w-lg mx-auto',
            },
          }}
        />

        <div className="mx-auto mt-16 flex h-52 w-full max-w-5xl items-center justify-center rounded-xl border border-divider bg-paper">
          Video Placeholder
        </div>
      </Container>

      <Container component="section" className="mt-24">
        <SectionHeading title="And more..." className="max-w-lg" />

        <div className="mx-auto mt-16 grid max-w-xs grid-cols-1 content-start justify-start gap-6 sm:max-w-2xl sm:auto-rows-fr sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
          <Card className="relative grid grid-flow-row place-content-center place-items-center gap-4 sm:row-span-15">
            <div className="relative">
              <LineGrid className="object-top-left left-1/2 top-1/2 mx-auto h-40 w-40 -translate-y-1/2 -translate-x-1/2" />
              <Glow />
              <Image
                src="/common/logo-circle.svg"
                width={100}
                height={100}
                alt="Nhost Logo in a dark circle"
                className="relative z-10 h-26 w-26"
              />
            </div>

            <SectionHeading
              title="Nhost"
              subtitle="Build apps users love"
              slotProps={{ title: { component: 'h3' } }}
            />

            <Button href="https://app.nhost.io/uploadFile" className="mt-6">
              Start building <ArrowRightIcon />
            </Button>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8">
            <Image
              src="/products/globe.svg"
              width={24}
              height={24}
              alt="Globe"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">CDN</h3>

              <p className="text-base text-white text-opacity-65">
                Files are served from a global CDN, caching your files at the
                edge.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-7">
            <Image
              src="/products/resize.svg"
              width={24}
              height={24}
              alt="Resize icon"
              className="mx-auto"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Image Transformation</h3>

              <p className="text-base text-white text-opacity-65">
                Transform images, on the fly, with query parameters.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8">
            <Image
              src="/products/maximize.svg"
              width={24}
              height={24}
              alt="Full screen icon"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">High Scalability</h3>

              <p className="text-base text-white text-opacity-65">
                Upload and download files at scale.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/box.svg"
              width={24}
              height={24}
              alt="A box"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Buckets</h3>

              <p className="text-base text-white text-opacity-65">
                Segment files into buckets, and control access with permissions.
              </p>
            </div>
          </Card>
        </div>
      </Container>

      <ProductSection
        slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
        heading={
          <div className="grid grid-flow-row items-center justify-items-center gap-4">
            <div className="gradient-background rounded-full p-px">
              <p className="rounded-full bg-paper px-4.5 py-1.5">
                There is more
              </p>
            </div>

            <SectionHeading title="Other features" />
          </div>
        }
        disabledLink="storage"
      />

      <CTASection />
    </>
  )
}

StoragePage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
