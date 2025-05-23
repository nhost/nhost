import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'
import { CustomerCard } from '@/components/common/CustomerCard'

export default function LovedBySection() {
  return (
    <>
      <Container
        component="section"
        slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
        className="grid grid-flow-row gap-14"
      >
        <div className="grid grid-flow-row justify-center gap-10">
          <SectionHeading
            title="Loved by teams who move fast"
            subtitle="Nhost powers everything from indie hacker side projects to the core infrastructure of scaling startups."
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
    </>
  )
}
