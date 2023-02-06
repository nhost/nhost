import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ReactElement } from 'react'

export default function PricingPage() {
  return (
    <>
      <Container
        component="section"
        className="relative flex max-w-5xl py-20 lg:py-28"
      >
        <LineGrid
          className="-top-5 left-0 right-0 mx-auto h-32 w-32 translate-x-0 scale-100 lg:top-5 lg:h-40 lg:w-40"
          slotProps={{ image: { className: 'mx-auto' } }}
        />
        <Glow className="h-10 w-32 blur-[50px] lg:top-28" />
        <SectionHeading
          title="Pricing"
          subtitle="Select your plan and start building"
          slotProps={{
            title: {
              component: 'h1',
              className: 'text-3.5xl md:text-5xl',
            },
          }}
          className="relative z-10"
        />
      </Container>

      <Container className="grid auto-rows-fr">
        <div className="grid auto-cols-fr grid-flow-col gap-6">
          <div className="col-span-5" />

          <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
            <SectionHeading
              title="Starter"
              subtitle="Free forever"
              className="gap-2"
              slotProps={{
                title: { className: 'text-3xl md:text-3xl' },
                subtitle: { className: 'text-base' },
              }}
            />

            <Button
              href="https://app.nhost.io/signup"
              rel="noopener noreferrer"
              target="_blank"
            >
              Start for free <ArrowRightIcon />
            </Button>
          </div>

          <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
            <SectionHeading
              title="Pro"
              subtitle="$25/mo"
              className="gap-2"
              slotProps={{
                title: { className: 'text-3xl md:text-3xl' },
                subtitle: { className: 'text-base' },
              }}
            />

            <p className="px-6 py-3 text-center">Buy Pro</p>
          </div>

          <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
            <SectionHeading
              title="Enterprise"
              subtitle="Custom plan"
              className="gap-2"
              slotProps={{
                title: { className: 'text-3xl md:text-3xl' },
                subtitle: { className: 'text-base' },
              }}
            />

            <p className="px-6 py-3 text-center">Contact Us</p>
          </div>
        </div>

        <section></section>
      </Container>
    </>
  )
}

PricingPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
