import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ArrowLeftIcon } from '@/components/common/icons/ArrowLeftIcon'
import Image from 'next/image'

const graphiteQuery = `query {
  graphiteSearchMovies(
    args: {
      query: "comedy in space",
      amount: 5
    }
  ) {
    name
    overview
    genre
  }
}`

export default function GraphiteHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative grid items-start grid-cols-1 gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="relative z-10 grid content-center justify-start grid-flow-row gap-4 pt-16 justify-items-start md:pt-42 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/graphite-logo.svg"
            width={20}
            height={20}
            alt="Graphite icon"
            priority
          />
        </ProductIcon>

        <div className="flex space-x-2">
          <h2 className="font-mona text-3.5xl font-semibold md:text-4.5xl">
            Graphite
          </h2>
        </div>

        <SectionHeading
          title=""
          subtitle="Infuse your Nhost Stack with AI capabilities and supercharge its potential."
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
      </div>

      <div className="relative sm:pt-6 md:-translate-x-1 md:pt-24">
        <LineGrid className="md:-translate-x-11 md:-translate-y-11" priority />

        <Glow className="h-[75%] w-full opacity-40 blur-3xl" />

        <Image
          src="/products/graphite-hero.png"
          alt="Auto-Embeddings page in the Nhost Dashboard"
          width={2880}
          height={1800}
          className="relative z-10 w-full h-auto"
          priority
          sizes="(max-width: 1024px) 50vw, 60vw"
        />

        <CodeSnippet
          language="graphql"
          disableGlow
          disableLineGrid
          className="absolute z-20 max-w-sm shadow-lg -right-3 -bottom-6 xl:-right-5 xl:-bottom-12"
        >
          {graphiteQuery}
        </CodeSnippet>
      </div>
    </Container>
  )
}
