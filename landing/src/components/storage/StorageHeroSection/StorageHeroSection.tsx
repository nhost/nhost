import { Button } from '@/components/common/Button'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

const heroExample = `const { body } = await nhost.storage.uploadFiles({ 
  'file[]': [file]
})

const fileMetadata = body.processedFiles?.[0];

const response = await nhost.storage.getFile(fileMetadata.id, 
  {
    w: 400,
    h: 300,
    q: 80
  }
)
`

export default function StorageHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative grid grid-cols-1 items-start gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-6 pt-16 md:pt-42 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/storage.svg"
            width={24}
            height={24}
            alt="A file icon"
            priority
          />
        </ProductIcon>

        <SectionHeading
          title={
            <>
              Scalable file{' '}
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">
                storage
              </span>
            </>
          }
          subtitle={
            <>
              Store, transform, and deliver files at blazing speed with our
              global CDN. <strong>Upload files</strong> with just a few lines of
              code, <strong>resize images</strong> on-the-fly, and{' '}
              <strong>control access</strong> with granular permissions.
            </>
          }
          className="text-left"
          slotProps={{
            title: {
              component: 'h1',
              className: 'font-semibold text-3.5xl md:text-4.5xl',
            },
            subtitle: {
              className: 'text-base !leading-normal',
            },
          }}
        />

        <div className="flex gap-4 pt-2">
          <Button
            className="text-center text-base"
            href="https://app.nhost.io/signup"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get started <ArrowRightIcon />
          </Button>
          <Button
            variant="outlined"
            className="text-center text-base"
            href="https://docs.nhost.io/products/storage"
            target="_blank"
            rel="noopener noreferrer"
          >
            View documentation
          </Button>
        </div>
      </div>

      <div className="relative sm:pt-6 md:pt-24">
        <LineGrid className="md:-translate-x-11 md:-translate-y-11" priority />

        <Glow className="mx-auto h-[75%] w-[90%] animate-pulse opacity-40 blur-3xl" />

        <Image
          src="/products/storage-hero.png"
          width={1920}
          height={991}
          alt="The Nhost Dashboard's storage page"
          className="relative z-10 mx-auto mb-32 h-auto w-full animate-slide-middle-up object-contain md:mb-0"
          priority
          sizes="(max-width: 1024px) 50vw, 60vw"
        />

        <CodeSnippet
          language="typescript"
          disableGlow
          disableLineGrid
          className="absolute right-0 top-0 z-10 mx-auto mt-4 max-w-sm animate-fade-in-delay shadow-lg sm:-bottom-6 sm:-right-3 xl:-bottom-12 xl:-right-5"
        >
          {heroExample}
        </CodeSnippet>
      </div>
    </Container>
  )
}
