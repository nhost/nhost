import { Button } from '@/components/common/Button'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

const heroExample = `await nhost.storage.upload({ file })`

export default function StorageHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative grid grid-cols-1 items-center gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-4 pt-16 md:pt-42 lg:px-20">
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
          title="Storage"
          subtitle="Store, transform, optimize, and deliver any file for your users at a blazing fast speed."
          className="text-left"
          slotProps={{
            title: {
              component: 'h1',
              className: 'font-semibold',
            },
            subtitle: {
              className: 'text-base !leading-normal',
            },
          }}
        />

        <Button
          href="https://app.nhost.io/uploadFile"
          rel="noopener noreferrer"
          target="_blank"
        >
          Start building <ArrowRightIcon />
        </Button>
      </div>

      <div className="relative sm:pt-6 md:pt-24">
        <LineGrid className="md:-translate-x-11 md:-translate-y-11" priority />

        <Glow className="mx-auto h-[75%] w-[90%] opacity-40 blur-3xl" />

        <Image
          src="/products/storage-hero.png"
          width={1920}
          height={991}
          alt="The Nhost Dashboard's storage page"
          className="relative z-10 mx-auto h-auto w-full object-contain"
          priority
        />

        <CodeSnippet
          language="typescript"
          disableGlow
          disableLineGrid
          className="absolute -right-3 -bottom-6 z-20 max-w-sm shadow-lg xl:-right-5 xl:-bottom-12"
        >
          {heroExample}
        </CodeSnippet>
      </div>
    </Container>
  )
}
