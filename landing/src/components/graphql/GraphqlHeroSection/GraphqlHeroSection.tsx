import { Button } from '@/components/common/Button'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

const heroExample = `query GetUsers {
  users(limit: 10) {
    id
    name
    email
    todos {
      id
      title
      completed
    }
  }
}`

export default function GraphqlHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative grid grid-cols-1 items-start gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-6 pt-16 md:pt-42 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/graphql.svg"
            width={24}
            height={24}
            alt="Logo of GraphQL"
            priority
          />
        </ProductIcon>

        <SectionHeading
          title={
            <>
              Instant <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">GraphQL API</span>
            </>
          }
          subtitle={
            <>
              Get a powerful GraphQL API generated automatically from your database schema. <strong>Queries</strong>, <strong>mutations</strong>, and <strong>realtime subscriptions</strong> with granular permissions, all without writing backend code.
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
            Get Started <ArrowRightIcon />
          </Button>
          <Button
            variant="outlined"
            className="text-center text-base"
            href="https://docs.nhost.io/graphql"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Documentation
          </Button>
        </div>
      </div>

      <div className="relative md:pt-20 lg:pt-0">
        <Glow className="absolute h-full w-full opacity-30 blur-3xl animate-pulse" />
        <div className="relative">
          <Image
            src="/products/graphql-hero.svg"
            width={608}
            height={608}
            alt="GraphQL logo"
            className="mx-auto h-full max-h-[400px] w-full object-none md:max-h-[none] md:object-none xl:-translate-y-4 animate-pulse"
            priority
          />
          
          <CodeSnippet
            language="graphql"
            disableGlow
            disableLineGrid
            className="absolute -right-3 -bottom-20 z-20 max-w-sm shadow-lg xl:-right-5 xl:-bottom-12 animate-fade-in-delay"
          >
            {heroExample}
          </CodeSnippet>
        </div>
      </div>
    </Container>
  )
}
