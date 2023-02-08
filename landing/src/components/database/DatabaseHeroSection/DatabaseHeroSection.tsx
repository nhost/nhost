import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

const heroExample = `await nhost.auth.signUp({
  email: 'joe@example.com',
  password: 'secret-password'
})`

export default function DatabaseHeroSection() {
  return (
    <Container
      component="section"
      className="grid grid-cols-1 items-start gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="grid grid-flow-row content-center justify-start justify-items-start gap-4 pt-16 md:pt-42 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/postgres.svg"
            width={24}
            height={24}
            alt="Logo of Postgres"
            priority
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
          href="https://app.nhost.io"
          rel="noopener noreferrer"
          target="_blank"
        >
          Start building <ArrowRightIcon />
        </Button>
      </div>

      <div className="relative sm:pt-6 md:pt-24">
        <LineGrid
          className="h-full w-full md:-translate-x-11 md:-translate-y-11"
          priority
        />

        <Glow className="h-[55%] w-1/2 opacity-40 blur-3xl md:h-1/2 md:w-[75%] md:-translate-x-18" />

        <Image
          src="/products/database-hero.svg"
          width={619}
          height={464}
          alt="A table with three columns"
          className="relative z-10 mx-auto h-auto w-full object-contain"
          priority
        />
      </div>
    </Container>
  )
}
