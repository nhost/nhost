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
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background mb-2 rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Simple Integration
            </p>
          </div>

          <SectionHeading
            title="Add storage in minutes"
            subtitle="Rapidly build production-ready file management for web and mobile apps. Just a few lines of code to handle uploads, downloads, and transformations."
            className="max-w-2xl"
            slotProps={{
              subtitle: {
                className: 'max-w-lg mx-auto',
              },
            }}
          />
        </div>

        <div className="grid grid-cols-1 items-start justify-items-center gap-8 pb-12 xl:grid-cols-2 xl:justify-items-start xl:gap-6">
          <div className="order-2 w-full xl:order-1">
            <CodeSnippet
              language="typescript"
              customStyle={{ minHeight: 220 }}
              slotProps={{
                root: {
                  className:
                    'mx-auto md:max-w-xl shadow-lg animate-fade-in-delay',
                },
              }}
            >
              {codeSnippets[selectedExample].trim()}
            </CodeSnippet>

            <div className="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
                <h3 className="text-sm font-bold">Type-Safe SDK</h3>
                <p className="mt-1 text-xs text-white text-opacity-65">
                  Full TypeScript support for a better developer experience
                </p>
              </div>
              <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
                <h3 className="text-sm font-bold">Works Everywhere</h3>
                <p className="mt-1 text-xs text-white text-opacity-65">
                  Seamless integration with React, Vue, Next.js, Flutter, and
                  more
                </p>
              </div>
            </div>
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
              className="absolute -top-32 left-0 right-0 z-0 mx-auto hidden h-auto w-full animate-pulse object-none xl:block"
            />
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background mb-2 rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Enterprise-Grade Security
            </p>
          </div>

          <SectionHeading
            title="Powerful permissions, made simple"
            subtitle="Storage permissions work like any other data in your database. Use Buckets to segment files and fine-grained permissions to control access."
            className="max-w-2xl"
            slotProps={{
              subtitle: {
                className: 'max-w-lg mx-auto',
              },
            }}
          />
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-6 rounded-lg border border-divider bg-paper p-6 shadow-md">
            <div className="rounded-lg border border-divider bg-black bg-opacity-30 p-4">
              <CodeSnippet
                language="graphql"
                disableGlow
                disableLineGrid
                className="shadow-lg"
              >
                {`# Storage permissions example
{
  file: {
    id: {_eq: X-Hasura-File-Id},
    bucket: {
      id: {_eq: "avatars"},
      userId: {_eq: X-Hasura-User-Id}
    }
  }
}`}
              </CodeSnippet>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-bold">
                Granular Access Control
              </h3>
              <p className="text-sm text-white text-opacity-80">
                Define fine-grained permissions for your files using the same
                powerful permission system as your database. Control who can
                upload, view, and modify files based on user roles and data
                relationships.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 content-start gap-4">
            <div className="rounded-lg border border-divider bg-paper p-5 shadow-md">
              <h3 className="mb-2 text-base font-bold">User-Specific Files</h3>
              <p className="text-sm text-white text-opacity-65">
                Ensure users can only access their own files. Perfect for
                profile pictures, private documents, and user-generated content.
              </p>
            </div>

            <div className="rounded-lg border border-divider bg-paper p-5 shadow-md">
              <h3 className="mb-2 text-base font-bold">Organization Buckets</h3>
              <p className="text-sm text-white text-opacity-65">
                Segment files by organization or team, allowing collaborative
                access while maintaining proper isolation between different
                groups.
              </p>
            </div>

            <div className="rounded-lg border border-divider bg-paper p-5 shadow-md">
              <h3 className="mb-2 text-base font-bold">
                Public vs. Private Files
              </h3>
              <p className="text-sm text-white text-opacity-65">
                Easily distinguish between public assets (like website images)
                and private files that require authentication to access.
              </p>
            </div>
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background mb-2 rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Performance Features
            </p>
          </div>

          <SectionHeading
            title="Global CDN & image transformations"
            subtitle="Deliver content blazing fast anywhere in the world while optimizing images on-the-fly for the perfect balance of quality and performance."
            className="max-w-2xl"
          />
        </div>

        <div className="mx-auto mt-12 grid max-w-xs grid-cols-1 content-start justify-start gap-6 sm:max-w-2xl sm:auto-rows-fr sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
          <Card className="relative grid grid-flow-row place-content-center place-items-center gap-4 shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-15">
            <div className="relative">
              <LineGrid className="object-top-left left-1/2 top-1/2 mx-auto h-40 w-40 -translate-y-1/2 -translate-x-1/2" />
              <Glow className="animate-pulse" />
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

            <Button href="https://app.nhost.io" className="mt-6">
              Start building <ArrowRightIcon />
            </Button>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8">
            <Image
              src="/products/globe.svg"
              width={24}
              height={24}
              alt="Globe"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Global CDN</h3>

              <p className="text-base text-white text-opacity-65">
                Files are automatically distributed to 80+ locations worldwide,
                ensuring low-latency access for users anywhere on the planet.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-7">
            <Image
              src="/products/resize.svg"
              width={24}
              height={24}
              alt="Resize icon"
              className="mx-auto"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Image Transformations</h3>

              <p className="text-base text-white text-opacity-65">
                Resize, crop, convert formats, and adjust quality on-the-fly
                with simple URL parameters. No need for pre-processing or
                multiple image versions.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8">
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
                Handle millions of uploads and downloads without breaking a
                sweat. Designed to scale effortlessly as your user base grows.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/box.svg"
              width={24}
              height={24}
              alt="A box"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Storage Buckets</h3>

              <p className="text-base text-white text-opacity-65">
                Organize files into logical buckets for different purposes -
                public assets, user uploads, backups, and more - each with its
                own permission rules.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/egress.svg"
              width={24}
              height={24}
              alt="A download icon"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Presigned URLs</h3>

              <p className="text-base text-white text-opacity-65">
                Generate temporary access links for private files, perfect for
                secure file sharing with time-limited access that automatically
                expires.
              </p>
            </div>
          </Card>
        </div>
      </Container>

      <ProductSection
        slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
        heading={
          <div className="grid grid-flow-row items-center justify-items-center gap-8">
            <div className="gradient-background rounded-full p-px">
              <p className="rounded-full bg-paper px-4.5 py-1.5">
                Complete Backend Platform
              </p>
            </div>

            <SectionHeading
              title="Explore the Nhost Ecosystem"
              subtitle="Storage is just one part of our complete backend platform. Discover how all our services work together to power your applications."
            />
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
