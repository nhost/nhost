import { Container, ContainerProps } from '@/components/common/Container'
import { ServiceCard } from '@/components/common/ServiceCard'
import Image from 'next/image'
import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export interface ProductSectionProps extends ContainerProps {
  /**
   * Heading of the section.
   */
  heading?: ReactNode
  /**
   * Determines which link should be disabled.
   */
  disabledLink?:
    | 'database'
    | 'graphql'
    | 'hasura'
    | 'auth'
    | 'storage'
    | 'functions'
    | 'run'
    | 'graphite'
}

export default function ProductSection({
  heading,
  className,
  disabledLink,
  ...props
}: ProductSectionProps) {
  return (
    <Container
      component="section"
      className={twMerge('grid grid-flow-row gap-14', className)}
      {...props}
    >
      {heading}

      <div className="grid justify-center grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <ServiceCard
          icon={
            <Image
              src="/products/postgres.svg"
              width={24}
              height={24}
              alt="Logo of Postgres"
            />
          }
          title="Postgres Database"
          description="The world's most advanced relational database."
          href="/product/database"
          disableLink={disabledLink === 'database'}
        />

        <ServiceCard
          icon={
            <Image
              src="/products/graphql.svg"
              width={24}
              height={24}
              alt="Logo of GraphQL"
            />
          }
          title="GraphQL API"
          description="Instant Realtime GraphQL API based on your database schema."
          href="/product/graphql"
          disableLink={disabledLink === 'graphql'}
        />

        <ServiceCard
          icon={
            <Image
              src="/products/hasura.svg"
              width={24}
              height={24}
              alt="Logo of Hasura"
            />
          }
          title="Hasura"
          description="Role-Based Permissions, Web Console, Event Triggers, Cron Jobs, and more."
        />

        <ServiceCard
          icon={
            <Image
              src="/products/authentication.svg"
              width={24}
              height={24}
              alt="A user icon"
            />
          }
          title="Auth"
          description="Sign in users with Email, Magic Link, SMS, Google, Facebook, etc."
          href="/product/auth"
          disableLink={disabledLink === 'auth'}
        />

        <ServiceCard
          icon={
            <Image
              src="/products/storage.svg"
              width={24}
              height={24}
              alt="A file icon"
            />
          }
          title="Storage"
          description="Let users upload and download images, documents and other files."
          href="/product/storage"
          disableLink={disabledLink === 'storage'}
        />

        <ServiceCard
          icon={
            <Image
              src="/products/functions.svg"
              width={24}
              height={24}
              alt="Lambda icon"
            />
          }
          title="Functions"
          description="Run custom code using JavaScript and TypeScript with infinite scale."
          href="/product/functions"
          disableLink={disabledLink === 'functions'}
        />

        <ServiceCard
          icon={
            <Image
              src="/products/play.svg"
              width={24}
              height={24}
              alt="PLay icon"
            />
          }
          title="Run"
          description="Run custom services written in your favourite language."
          className="place-self-center"
          href="/product/run"
          disableLink={disabledLink === 'run'}
        />
        <ServiceCard
          icon={
            <Image
              src="/products/graphite-logo.svg"
              width={20}
              height={20}
              alt="Graphite icon"
              priority
            />
          }
          title="Graphite"
          description="Run AI workloads easily alongside your Nhost Stack."
          className="place-self-center"
          href="/product/graphite"
          disableLink={disabledLink === 'graphite'}
        />
      </div>
    </Container>
  )
}
