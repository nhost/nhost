import { Button } from '@/components/common/Button'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

const heroExample = `SELECT * FROM customers
WHERE country = 'USA'
AND last_purchase > '2023-01-01';`

export default function DatabaseHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="grid grid-cols-1 items-start gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="grid grid-flow-row content-center justify-start justify-items-start gap-6 pt-16 md:pt-42 lg:px-20">
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
          title={
            <>
              Enterprise-Grade{' '}
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">
                PostgreSQL
              </span>
            </>
          }
          subtitle={
            <>
              Fully-managed PostgreSQL database with a user-friendly interface.{' '}
              <strong>Create tables</strong>, <strong>edit data</strong>, and{' '}
              <strong>manage permissions</strong> with ease, or connect directly
              with <strong>psql</strong> as a root user.
            </>
          }
          className="text-left"
          slotProps={{
            title: {
              component: 'h1',
              className: 'font-semibold text-3.5xl md:text-4.5xl',
            },
            subtitle: { className: 'text-base !leading-normal' },
          }}
        />

        <div className="flex gap-4 pt-2">
          <Button
            className="text-center text-base"
            href="https://app.nhost.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get started <ArrowRightIcon />
          </Button>
          <Button
            variant="outlined"
            className="text-center text-base"
            href="https://docs.nhost.io/products/database"
            target="_blank"
            rel="noopener noreferrer"
          >
            View documentation
          </Button>
        </div>
      </div>

      <div className="relative sm:pt-6 md:pt-24">
        <LineGrid
          className="h-full w-full md:-translate-x-11 md:-translate-y-11"
          priority
        />

        <Glow className="h-[55%] w-1/2 animate-pulse opacity-40 blur-3xl md:h-1/2 md:w-[75%] md:-translate-x-18" />

        <Image
          src="/products/database-hero.svg"
          width={619}
          height={464}
          alt="A table with three columns"
          className="relative z-10 mx-auto h-auto w-full animate-slide-middle-up object-contain"
          priority
        />

        <CodeSnippet
          language="sql"
          disableGlow
          disableLineGrid
          className="absolute -right-3 -bottom-6 z-20 max-w-sm animate-fade-in-delay shadow-lg xl:-right-5 xl:-bottom-12"
        >
          {heroExample}
        </CodeSnippet>
      </div>
    </Container>
  )
}
