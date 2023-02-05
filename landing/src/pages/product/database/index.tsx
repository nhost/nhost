import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'
import { ReactElement } from 'react'

export default function DatabasePage() {
  return (
    <>
      <Container className="grid grid-cols-1 gap-14 py-8 sm:grid-cols-2 sm:gap-6 sm:py-24">
        <div className="grid grid-flow-row content-center justify-start justify-items-start gap-4 lg:px-28">
          <ProductIcon>
            <Image
              src="/products/postgres.svg"
              width={24}
              height={24}
              alt="Logo of Postgres"
            />
          </ProductIcon>

          <SectionHeading
            title="Postgres Database"
            subtitle="Control your database like a spreadsheet. Or connect directly to Postgres via 'psql' as a root user."
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

          <Button
            href="https://app.nhost.io/signup"
            rel="noopener noreferrer"
            target="_blank"
          >
            Start building <ArrowRightIcon />
          </Button>
        </div>

        <div className="relative">
          <LineGrid
            className="md:-translate-x-11 md:-translate-y-11"
            priority
          />

          <Glow className="h-3/5 w-3/5 opacity-40 blur-3xl md:-translate-x-11" />

          <Image
            src="/common/database-hero.svg"
            width={619}
            height={464}
            alt="A table with three columns"
            className="relative z-10"
            priority
          />
        </div>
      </Container>
      <CTASection />
    </>
  )
}

DatabasePage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
