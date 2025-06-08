import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { BarChartIcon } from '@/components/common/icons/BarChartIcon'
import { CursorIcon } from '@/components/common/icons/CursorIcon'
import { LocationIcon } from '@/components/common/icons/LocationIcon'
import { UserIcon } from '@/components/common/icons/UserIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import { GraphqlHeroSection } from '@/components/graphql/GraphqlHeroSection'
import { ProductSection } from '@/components/product/ProductSection'
import Image from 'next/image'
import { ReactElement, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const realtimeCodeSnippets = {
  avatars: `subscription {
  users {
    id
    displayName
    profile {
      id
      isOnline
    }
  }
}`,
  cursors: `subscription ($documentId: uuid!) {
  document (id: $docuentId) {
    id
    cursors {
      id
      color
      position
      user {
        id
        displayName
      }
    }
  }
}`,
  location: `subscription ($orderId: uuid!) {
  order (id: $orderId) {
    id
    location {
      id
      latitude
      longitude
    }
  }
}`,
  charts: `subscription ($chartId: uuid!) {
  chart (id: $chartId) {
    id
    data {
      id
      value
    }
  }
}`,
}

export default function GraphqlPage() {
  const [selectedRealtimeExample, setSelectedRealtimeExample] =
    useState<keyof typeof realtimeCodeSnippets>('avatars')

  return (
    <>
      <GraphqlHeroSection />

      <Container component="section" className="mt-8 pt-28">
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background mb-2 rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Enterprise-grade security
            </p>
          </div>

          <SectionHeading
            title="Powerful and simple permissions"
            subtitle="Control exactly what data users can access without writing complex authorization code."
            className="max-w-2xl"
            slotProps={{ subtitle: { className: 'max-w-lg mx-auto' } }}
          />
        </div>

        <div className="mx-auto mt-16 flex w-full max-w-5xl items-center justify-center rounded-xl border border-divider bg-paper shadow-lg">
          <video autoPlay loop muted controls className="rounded-lg">
            <source src={`/videos/graphql/permissions.mp4`} type="video/mp4" />
          </video>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-6">
          <div className="rounded-lg border border-divider bg-paper p-6 shadow-md">
            <h3 className="mb-3 text-lg font-bold">Row level security</h3>
            <p className="text-base text-white text-opacity-65">
              Control which rows users can access based on their identity or
              role. Ensure users only see their own data or data specifically
              shared with them.
            </p>
          </div>

          <div className="rounded-lg border border-divider bg-paper p-6 shadow-md">
            <h3 className="mb-3 text-lg font-bold">Column level security</h3>
            <p className="text-base text-white text-opacity-65">
              Hide sensitive fields from unauthorized users. Protect personal
              information while still allowing access to other data in the same
              table.
            </p>
          </div>
        </div>
      </Container>

      <Container
        component="section"
        className="mt-24 pb-12 lg:mt-40"
        slotProps={{ root: { className: 'overflow-hidden' } }}
      >
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background mb-2 rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Build collaborative apps
            </p>
          </div>

          <SectionHeading
            title="Realtime subscriptions"
            subtitle="Create modern, collaborative applications with GraphQL subscriptions. Get live data updates pushed to your client in real-time without complex WebSocket setup."
          />
        </div>

        <div className="mx-auto mt-12 grid items-start gap-12 md:grid-cols-2 lg:mt-24 lg:max-w-5xl">
          <ul className="grid grid-flow-row gap-6 md:max-w-sm">
            <li
              className={twMerge(
                'grid grid-flow-row items-start justify-start rounded-lg border border-transparent p-4 text-white text-opacity-100 motion-safe:transition-colors',
                selectedRealtimeExample === 'avatars'
                  ? 'border-brand-main bg-paper bg-opacity-40'
                  : 'text-opacity-65 hover:text-opacity-100',
              )}
              role="button"
              tabIndex={0}
              aria-label="Live avatars"
              onClick={() => setSelectedRealtimeExample('avatars')}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }

                event.preventDefault()

                setSelectedRealtimeExample('avatars')
              }}
            >
              <div className="grid grid-flow-col items-center justify-start gap-4">
                <UserIcon className="h-5 w-5" />
                <h3 className="font-mona text-base font-bold">Live avatars</h3>
              </div>

              <p className="ml-8 mt-2 text-sm">
                Show online status and user presence in real-time across
                multiple clients. Perfect for chat applications and
                collaborative workspaces.
              </p>
            </li>

            <li
              className={twMerge(
                'grid grid-flow-row items-start justify-start rounded-lg border border-transparent p-4 text-white text-opacity-100 motion-safe:transition-colors',
                selectedRealtimeExample === 'cursors'
                  ? 'border-brand-main bg-paper bg-opacity-40'
                  : 'text-opacity-65 hover:text-opacity-100',
              )}
              role="button"
              tabIndex={0}
              aria-label="Live cursors"
              onClick={() => setSelectedRealtimeExample('cursors')}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }

                event.preventDefault()

                setSelectedRealtimeExample('cursors')
              }}
            >
              <div className="grid grid-flow-col items-center justify-start gap-4">
                <CursorIcon className="h-5 w-5" />
                <h3 className="font-mona text-base font-bold">Live cursors</h3>
              </div>

              <p className="ml-8 mt-2 text-sm">
                Create Google Docs-like experiences with multi-user cursor
                positions updated in real-time. Enable truly collaborative
                document editing.
              </p>
            </li>

            <li
              className={twMerge(
                'grid grid-flow-row items-start justify-start rounded-lg border border-transparent p-4 text-white text-opacity-100 motion-safe:transition-colors',
                selectedRealtimeExample === 'location'
                  ? 'border-brand-main bg-paper bg-opacity-40'
                  : 'text-opacity-65 hover:text-opacity-100',
              )}
              role="button"
              tabIndex={0}
              aria-label="Location"
              onClick={() => setSelectedRealtimeExample('location')}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }

                event.preventDefault()

                setSelectedRealtimeExample('location')
              }}
            >
              <div className="grid grid-flow-col items-center justify-start gap-4">
                <LocationIcon className="h-5 w-5" />
                <h3 className="font-mona text-base font-bold">Live location</h3>
              </div>

              <p className="ml-8 mt-2 text-sm">
                Build location-tracking applications with real-time updates.
                Perfect for delivery tracking, ride-sharing, or fleet management
                apps.
              </p>
            </li>

            <li
              className={twMerge(
                'grid grid-flow-row items-start justify-start rounded-lg border border-transparent p-4 text-white text-opacity-100 motion-safe:transition-colors',
                selectedRealtimeExample === 'charts'
                  ? 'border-brand-main bg-paper bg-opacity-40'
                  : 'text-opacity-65 hover:text-opacity-100',
              )}
              role="button"
              tabIndex={0}
              aria-label="Live charts"
              onClick={() => setSelectedRealtimeExample('charts')}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }

                event.preventDefault()

                setSelectedRealtimeExample('charts')
              }}
            >
              <div className="grid grid-flow-col items-center justify-start gap-4">
                <BarChartIcon className="h-5 w-5" />
                <h3 className="font-mona text-base font-bold">Live charts</h3>
              </div>

              <p className="ml-8 mt-2 text-sm">
                Create dashboards with real-time data visualization. Get instant
                updates without polling, perfect for analytics, monitoring, and
                IoT applications.
              </p>
            </li>
          </ul>

          <div className="flex flex-col gap-4">
            <CodeSnippet
              language="graphql"
              customStyle={{ minHeight: 300 }}
              className="shadow-lg"
            >
              {realtimeCodeSnippets[selectedRealtimeExample]}
            </CodeSnippet>

            <div className="rounded-lg border border-divider bg-paper p-4">
              <h4 className="mb-2 text-sm font-bold">
                Why subscriptions matter
              </h4>
              <p className="text-sm text-white text-opacity-65">
                Unlike traditional REST APIs that require polling, GraphQL
                subscriptions push data to clients only when changes occur,
                reducing server load and improving UX with real-time updates.
              </p>
            </div>
          </div>
        </div>
      </Container>

      <Container
        component="section"
        className="mt-20 lg:mt-40"
        slotProps={{ root: { className: 'overflow-hidden' } }}
      >
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background mb-2 rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Unified data access
            </p>
          </div>

          <SectionHeading
            title="Data federation"
            subtitle="Connect multiple data sources into a single, unified GraphQL API. Combine your database with custom services, third-party services, and legacy systems - all through one powerful API."
          />
          {/* <Glow className="absolute top-1/2 left-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse opacity-40 blur-3xl" /> */}
          <Image
            src="/products/data-federation.svg"
            alt="Nhost being connected to data sources"
            width={1110}
            height={1110}
            className="mx-auto h-auto w-full max-w-lg scale-150 sm:scale-100 sm:object-none"
          />
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          <div className="rounded-lg border border-divider bg-paper p-6 shadow-md">
            <h3 className="mb-3 text-lg font-bold">Single API</h3>
            <p className="text-sm text-white text-opacity-65">
              Access all your data through a single, consistent GraphQL API,
              eliminating the need to manage multiple endpoints.
            </p>
          </div>

          <div className="rounded-lg border border-divider bg-paper p-6 shadow-md">
            <h3 className="mb-3 text-lg font-bold">Remote schemas</h3>
            <p className="text-sm text-white text-opacity-65">
              Connect third-party REST APIs and other GraphQL services directly
              into your main API with remote schemas.
            </p>
          </div>

          <div className="rounded-lg border border-divider bg-paper p-6 shadow-md">
            <h3 className="mb-3 text-lg font-bold">Run</h3>
            <p className="text-sm text-white text-opacity-65">
              Use Nhost Run to run your own services and APIs, and connect them
              as remote schemas.
            </p>
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background mb-2 rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              More capabilities
            </p>
          </div>

          <SectionHeading
            title="Advanced GraphQL features"
            subtitle="Everything you need to run and manage modern and high-performance APIs all in one platform."
            className="max-w-2xl"
          />
        </div>

        <div className="mx-auto mt-16 grid max-w-xs grid-cols-1 content-start justify-start gap-6 sm:max-w-2xl sm:auto-rows-fr sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
          <Card className="relative grid grid-flow-row place-content-center place-items-center gap-4 shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-15">
            <div className="relative">
              <LineGrid className="object-top-left left-1/2 top-1/2 mx-auto h-40 w-40 -translate-y-1/2 -translate-x-1/2" />
              <Glow className="animate-pulse" />
              <Image
                src="/common/logo-circle.svg"
                width={100}
                height={100}
                alt="Nhost Logo in a dark circle"
                className="relative z-10 h-26 w-26"
              />
            </div>

            <SectionHeading
              title="Nhost"
              subtitle="Build powerful APIs users love"
              slotProps={{ title: { component: 'h3' } }}
            />

            <Button href="https://app.nhost.io" className="mt-6">
              Start building <ArrowRightIcon />
            </Button>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8">
            <Image
              src="/products/database.svg"
              width={24}
              height={24}
              alt="A database"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Advanced querying</h3>

              <p className="text-base text-white text-opacity-65">
                Filter, sort, order by, group, aggregate, limit, and offset.
              </p>
              <p className="text-base text-white text-opacity-65">
                Express complex queries with a clean, type-safe GraphQL API
                without writing any backend code.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-7">
            <Image
              src="/products/search.svg"
              width={24}
              height={24}
              alt="Magnifying glass"
              className="mx-auto"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Full-text search</h3>

              <p className="text-base text-white text-opacity-65">
                Powerful full-text search capabilities built right into your
                GraphQL API. No need to set up and manage a separate search
                engine.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8">
            <Image
              src="/products/hasura.svg"
              width={24}
              height={24}
              alt="Logo of Hasura"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Security & observability</h3>

              <p className="text-base text-white text-opacity-65">
                Observability metrics include request rate, duration, and
                failure rate. Security features include disabling the admin
                secret and limiting query depth
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/checkmark.svg"
              width={24}
              height={24}
              alt="A checkmark in a circle"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">N+1 Problem Solved</h3>

              <p className="text-base text-white text-opacity-65">
                All your GraphQL queries are compiled to a single SQL query,
                thereby improving performance.
              </p>
            </div>
          </Card>
        </div>
      </Container>

      <ProductSection
        slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
        heading={
          <div className="grid grid-flow-row items-center justify-items-center gap-8">
            <div className="gradient-background rounded-full p-px">
              <p className="rounded-full bg-paper px-4.5 py-1.5">
                Your backend platform
              </p>
            </div>

            <SectionHeading
              title="Explore the Nhost ecosystem"
              subtitle="An auto-generated GraphQL API is just one part of your backend stack. Discover how all our services work together to power your applications."
            />
          </div>
        }
        disabledLink="graphql"
      />

      <CTASection />
    </>
  )
}

GraphqlPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
