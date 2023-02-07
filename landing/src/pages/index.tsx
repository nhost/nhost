import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { CustomerCard } from '@/components/common/CustomerCard'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ExamplesSection } from '@/components/home/ExamplesSection'
import { HeroSection } from '@/components/home/HeroSection'
import WorkflowSection from '@/components/home/WorkflowSection'
import { ProductSection } from '@/components/product/ProductSection'
import Image from 'next/image'
import { ReactElement } from 'react'

export default function IndexPage() {
  return (
    <>
      <HeroSection />

      <Container
        component="section"
        slotProps={{ root: { className: 'mt-14 z-40 relative' } }}
        className="grid grid-flow-row justify-center gap-12 text-center"
      >
        <h2 className="text-base text-white text-opacity-65">
          Trusted by developers
        </h2>

        <div className="flex flex-row flex-wrap items-center justify-center gap-x-6 gap-y-6 lg:gap-x-12 lg:gap-y-8">
          <Image
            src="/customers/celsia.svg"
            alt="Celsia Logo"
            width={139}
            height={18}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/react-flow.svg"
            alt="React Flow Logo"
            width={121}
            height={20}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/midnight-society.png"
            alt="Midnight Society Logo"
            width={117}
            height={26}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/revtron.svg"
            alt="RevTron Logo"
            width={140}
            height={30}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/slides-with-friends.svg"
            alt="Slides with friends Logo"
            width={99}
            height={39}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/react-play.svg"
            alt="React Play Logo"
            width={123}
            height={22}
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
              subtitle="Get a database and backend configure and ready in minutes so you can focus on your app and your users."
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

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <CustomerCard
            image={
              <Image
                src="/customers/slides-with-friends.svg"
                alt="Logo of Slides with friends"
                width={142}
                height={64}
              />
            }
            title="Slides with friends"
            description="Interactive slides for amazing events, meetings, and lessons. Powering 10,000+ users around the globe."
            href="/customers/slides-with-friends"
          />

          <CustomerCard
            image={
              <Image
                src="/customers/celsia.svg"
                alt="Logo of Celsia"
                width={140}
                height={40}
              />
            }
            title="Celsia"
            description="Interactive slides for amazing events, meetings, and lessons. Powering 10,000+ users around the globe."
            href="/customers/celsia"
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
            description="Interactive slides for amazing events, meetings, and lessons. Powering 10,000+ users around the globe."
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
