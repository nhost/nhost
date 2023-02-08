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
        slotProps={{ root: { className: 'mt-14 z-30 relative' } }}
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
            <div className="gradient-background rounded-full p-px">
              <p className="rounded-full bg-paper px-4.5 py-1.5">
                100% Open Source
              </p>
            </div>

            <SectionHeading
              title="Backend without limits"
              subtitle="Get a database and backend configured and ready-to-use in minutes so you can focus on your app and your users."
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
            title="Ship faster with Nhost"
            subtitle="What used to take months, now takes minutes."
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
            description="Successful launch of community-driven game by Midnight Society and Boom.tv with Nhost's efficient backend platform"
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
            description="React Flow streamlines auth and builds a successful subscription platform in 2 months with the help of Nhost's integrated solution."
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
            description="RevTron uses Nhost for successful revenue growth and streamlined customer onboarding."
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
