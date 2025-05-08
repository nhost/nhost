import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { CustomerCard } from '@/components/common/CustomerCard'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ExamplesSection } from '@/components/home/ExamplesSection'
import { HeroSection } from '@/components/home/HeroSection'
import { WorkflowSection } from '@/components/home/WorkflowSection'
import { ProductSection } from '@/components/product/ProductSection'
import Image from 'next/image'
import { ReactElement } from 'react'

export default function IndexPage() {
  return (
    <>
      <HeroSection />

      <Container
        component="section"
        slotProps={{ root: { className: 'pt-14 z-30 relative' } }}
        className="grid grid-flow-row justify-center gap-12 text-center"
      >
        <h2 className="text-base text-white text-opacity-65">
          Trusted by developers
        </h2>

        <div className="flex flex-row flex-wrap items-center justify-center gap-x-6 gap-y-6 lg:gap-x-12 lg:gap-y-8">
          <Image
            src="/customers/celsia.svg"
            alt="Celsia Logo"
            width={140}
            height={40}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/react-flow.svg"
            alt="React Flow Logo"
            width={168}
            height={41}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/midnight-society.png"
            alt="Midnight Society Logo"
            width={136}
            height={42}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/revtron.svg"
            alt="RevTron Logo"
            width={163}
            height={24}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/slides-with-friends.svg"
            alt="Slides with friends Logo"
            width={142}
            height={64}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/react-play.svg"
            alt="React Play Logo"
            width={153}
            height={55}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />
        </div>
      </Container>

      <ProductSection
        slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
        heading={
          <div className="grid grid-flow-row items-center justify-items-center gap-4">
            <div className="gradient-background rounded-full p-px mb-2">
              <p className="rounded-full bg-paper px-4.5 py-1.5">
                100% Open Source
              </p>
            </div>

            <SectionHeading
              title="Stop Juggling, Start Building"
              subtitle="Get a complete, production-ready backend in minutes. No more stitching together separate services or managing complex infrastructure."
            />
          </div>
        }
      />

      <Container
        component="section"
        slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
        className="grid grid-flow-row gap-14"
      >
        <div className="grid grid-flow-row justify-center gap-10">
          <SectionHeading
            title="Trusted by Developers Worldwide"
            subtitle="From startups to enterprises, see how teams ship faster and scale confidently with Nhost."
          />

          <Button className="justify-self-center text-base" href="/customers">
            Learn more <ArrowRightIcon />
          </Button>
        </div>

        <div className="relative mx-auto grid max-w-lg grid-cols-1 gap-6 px-5 pb-16 sm:grid-cols-1 lg:max-w-7xl lg:grid-cols-3 lg:px-0 lg:pb-28">
          <CustomerCard
            image={
              <Image
                src="/customers/midnight-society.png"
                alt="Logo of Midnight Society"
                width={136}
                height={42}
              />
            }
            title="Midnight Society"
            description="Midnight Society launched their game to 400,000+ users in just 6 weeks using Nhost. Their team saved months of development time with our end-to-end backend solution."
            href="/customers/midnight-society"
          />

          <CustomerCard
            image={
              <Image
                src="/customers/react-flow.svg"
                alt="Logo of React Flow"
                width={168}
                height={41}
              />
            }
            title="React Flow"
            description="React Flow implemented a complete subscription platform in just 2 months with Nhost. Their small team was able to focus on product features instead of backend infrastructure."
            href="/customers/react-flow"
          />

          <CustomerCard
            image={
              <Image
                src="/customers/revtron.svg"
                alt="Logo of Revtron"
                width={163}
                height={24}
              />
            }
            title="Revtron"
            description="RevTron achieved triple-digit growth using Nhost to power their analytics platform. They reduced onboarding time by 80% and could rapidly adapt to customer needs."
            href="/customers/revtron"
          />
        </div>
      </Container>

      <WorkflowSection />
      <ExamplesSection />
      <CTASection />
    </>
  )
}

IndexPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
