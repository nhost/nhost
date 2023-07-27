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
      className="relative grid items-start grid-cols-1 gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="relative z-10 grid content-center justify-start grid-flow-row gap-4 pt-16 justify-items-start md:pt-42 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/play.svg"
            width={30}
            height={30}
            alt="Play icon"
            priority
          />
        </ProductIcon>

        <SectionHeading
          title="Run"
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

      <div className="relative sm:pt-6 md:pt-24">
        <LineGrid className="md:-translate-x-11 md:-translate-y-11" priority />

        <Glow className="mx-auto h-[75%] w-[90%] opacity-40 blur-3xl" />

        <Image
          src="/products/nhost-run-hero.png"
          width={1920}
          height={991}
          alt="The Nhost Dashboard's storage page"
          className="relative z-10 object-contain w-full h-auto mx-auto"
          priority
          sizes="(max-width: 1024px) 50vw, 60vw"
        />

        <CodeSnippet
          disableGlow
          disableLineGrid
          className="absolute z-20 shadow-lg -right-12 -bottom-6 xl:-right-12 xl:-bottom-12"
        >
          https://subdomain-cat-generator-3000.svc.eu-central-1.nhost.run
        </CodeSnippet>
      </div>
    </Container>
  )
}
