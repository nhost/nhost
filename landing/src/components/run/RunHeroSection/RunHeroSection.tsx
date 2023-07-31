import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

export default function RunHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative flex flex-col space-y-14 md:flex-row md:space-x-14"
    >
      <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-4 pt-16 md:w-1/3 md:pt-42 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/play.svg"
            width={30}
            height={30}
            alt="Play icon"
            priority
          />
        </ProductIcon>

        <div className="flex space-x-2">
          <h2 className="font-mona text-3.5xl font-semibold md:text-4.5xl">
            Run
          </h2>
          <div className="flex items-center self-end rounded-full bg-brand-dark">
            <div className="grid h-8 w-8 place-content-center rounded-full bg-brand-main">
              β
            </div>
            <span className="pl-3 pr-4 text-xs">Private Beta</span>
          </div>
        </div>

        <SectionHeading
          title=""
          subtitle="Build, Push, and Run custom services alongside your Nhost Stack."
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

      <div className="relative sm:pt-6 md:w-2/3 md:pt-24">
        <LineGrid className="md:-translate-x-11 md:-translate-y-11" priority />

        <Glow className="mx-auto h-[75%] w-[90%] opacity-40 blur-3xl" />

        <Image
          src="/products/run-hero.png"
          width={1920}
          height={991}
          alt="The Nhost Dashboard's storage page"
          className="relative z-10 mx-auto h-auto w-full object-contain"
          priority
          sizes="(max-width: 1024px) 50vw, 60vw"
        />

        <CodeSnippet
          disableGlow
          disableLineGrid
          className="absolute -right-12 -bottom-6 z-20 shadow-lg xl:-right-12 xl:-bottom-12"
        >
          https://lyrrkocvcfbfmmnicyuv-cat-generator-5000.svc.eu-central-1.nhost.run/cat
        </CodeSnippet>
      </div>
    </Container>
  )
}
