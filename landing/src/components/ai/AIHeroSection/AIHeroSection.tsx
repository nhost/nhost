import { Button } from '@/components/common/Button'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

const graphiteQuery = `
query {
  graphiteSearchMovies(
    args: {
      query: "comedy in space",
      amount: 5
    }
  ) {
    name
    overview
    genre
    score
  }
}`

export default function AIHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative grid grid-cols-1 items-start gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-6 pt-16 md:pt-42 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/graphite-logo.svg"
            width={20}
            height={20}
            alt="Graphite icon"
            priority
          />
        </ProductIcon>

        <SectionHeading
          title={
            <>
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">
                AI
              </span>{' '}
              Toolkit
            </>
          }
          subtitle="Vector search, embeddings generation, AI agents, and more - integrate advanced AI features with just a few simple configurations."
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
            href="https://app.nhost.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get Started <ArrowRightIcon />
          </Button>
          <Button
            variant="outlined"
            className="text-center text-base"
            href="https://docs.nhost.io/products/ai"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Documentation
          </Button>
        </div>
      </div>

      <div className="relative sm:pt-6 md:-translate-x-1 md:pt-24">
        <LineGrid className="md:-translate-x-11 md:-translate-y-11" priority />

        <Glow className="h-[75%] w-full animate-pulse opacity-40 blur-3xl" />

        <Image
          src="/products/graphite-hero.png"
          alt="Auto-Embeddings page in the Nhost Dashboard"
          width={2880}
          height={1800}
          className="relative z-10 h-auto w-full animate-slide-middle-up"
          priority
          sizes="(max-width: 1024px) 50vw, 60vw"
        />

        <div className="absolute -right-3 -bottom-6 z-20 flex flex-col gap-4 xl:-right-5 xl:-bottom-24">
          <CodeSnippet
            language="graphql"
            disableGlow
            disableLineGrid
            className="max-w-sm animate-fade-in-delay shadow-lg"
          >
            {graphiteQuery}
          </CodeSnippet>
        </div>
      </div>
    </Container>
  )
}
