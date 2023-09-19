import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ArrowLeftIcon } from '@/components/common/icons/ArrowLeftIcon'
import Image from 'next/image'
import Link from 'next/link'

export default function RunHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative grid grid-cols-1 items-start gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-4 pt-16 md:pt-42 lg:px-20">
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

      <div className="relative sm:pt-6 md:pt-24">
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

        <div className="flex items-center justify-center space-x-2 rounded-xl bg-paper py-2">
          <a
            href="https://tcspovfliddfqpzfloes-5000.svc.eu-central-1.nhost.run/cat"
            target="_blank"
            rel="noreferrer noopener"
            className="z-50 hover:underline"
          >
            https://tcspovfliddfqpzfloes-5000.svc.eu-central-1.nhost.run/cat
          </a>
          <div className="flex h-6 w-6 items-center ">
            <ArrowLeftIcon className="animate-bounce-right-left text-brand-main" />
          </div>
        </div>
      </div>
    </Container>
  )
}
