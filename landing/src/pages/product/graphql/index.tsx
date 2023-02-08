import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { ExampleSelectorButton } from '@/components/common/ExampleSelectorButton'
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

const codeSnippets = {
  insertData: `// todo: create example`,
  readData: `// todo: create example`,
  updateData: `// todo: create example`,
  deleteData: `// todo: create example`,
}

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
  const [selectedExample, setSelectedExample] =
    useState<keyof typeof codeSnippets>('insertData')

  const [selectedRealtimeExample, setSelectedRealtimeExample] =
    useState<keyof typeof realtimeCodeSnippets>('avatars')

  return (
    <>
      <GraphqlHeroSection />

      <Container
        component="section"
        className="grid grid-flow-row gap-16 md:gap-24"
        slotProps={{
          root: { className: 'overflow-hidden xl:overflow-visible hidden' },
        }}
      >
        <div className="grid grid-flow-row justify-items-center gap-8">
          <SectionHeading
            title="Type-safe GraphQL API"
            subtitle="Nhost GraphQL Client is tailored to your GraphQL API. The auto-completion helps you figure out your query without the need for documentation."
          />

          <Button
            variant="borderless"
            className="text-base font-bold"
            size="sm"
          >
            Explore the docs <ArrowRightIcon />
          </Button>
        </div>

        <div className="grid grid-cols-1 items-center justify-items-center gap-0 pb-12 xl:grid-cols-2 xl:justify-items-start xl:gap-6">
          <div className="order-2 w-full xl:order-1">
            <CodeSnippet
              language="typescript"
              className="min-h-[330px]"
              slotProps={{ root: { className: 'mx-auto md:max-w-xl' } }}
            >
              {codeSnippets[selectedExample]}
            </CodeSnippet>
          </div>

          <div className="relative order-1 w-full max-w-3xl xl:order-2">
            <div className="relative z-10 grid grid-flow-col justify-around xl:max-w-none">
              <ExampleSelectorButton
                active={selectedExample === 'insertData'}
                onClick={() => setSelectedExample('insertData')}
              >
                Insert Data
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'readData'}
                onClick={() => setSelectedExample('readData')}
              >
                Read Data
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'updateData'}
                onClick={() => setSelectedExample('updateData')}
              >
                Update Data
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'deleteData'}
                onClick={() => setSelectedExample('deleteData')}
              >
                Delete Data
              </ExampleSelectorButton>
            </div>

            <Image
              src="/products/connector-lines.svg"
              alt="Dashed lines"
              width={506}
              height={97}
              className="h-auto w-full"
            />

            <Image
              src="/common/logo-glow.svg"
              width={1220}
              height={1220}
              alt="Nhost Logo in a dark circle"
              className="absolute top-11 left-0 right-0 z-0 mx-auto hidden h-auto w-full max-w-[280px] object-none xl:block"
            />
          </div>
        </div>
      </Container>

      <Container component="section" className="pt-8">
        <SectionHeading
          title="Powerful and simple permissions"
          subtitle="Row and column level permissions to safely expose your GraphQL API to the world"
          className="max-w-2xl"
          slotProps={{ subtitle: { className: 'max-w-lg mx-auto' } }}
        />

        <div className="mx-auto mt-16 flex w-full max-w-5xl items-center justify-center rounded-xl border border-divider bg-paper">
          <video autoPlay loop muted controls className="rounded-lg">
            <source src={`/videos/graphql/permissions.mp4`} type="video/mp4" />
          </video>
        </div>
      </Container>

      <Container
        component="section"
        className="mt-24 pb-12 lg:mt-40"
        slotProps={{ root: { className: 'overflow-hidden' } }}
      >
        <SectionHeading
          title="Realtime Subscriptions"
          subtitle="Build collaborative apps with ease."
        />

        <div className="mx-auto mt-8 grid items-start gap-12 md:grid-cols-2 lg:mt-24 lg:max-w-5xl">
          <ul className="grid grid-flow-row gap-6 md:max-w-sm">
            <li
              className={twMerge(
                'grid grid-flow-row items-start justify-start text-white text-opacity-100 motion-safe:transition-colors',
                selectedRealtimeExample !== 'avatars' && 'text-opacity-65',
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
                <UserIcon className="h-4 w-4" />
                <h3 className="font-mona text-base font-bold">Live avatars</h3>
              </div>

              <p className="ml-8">
                Share the status of users across multiple clients.
              </p>
            </li>

            <li
              className={twMerge(
                'grid grid-flow-row items-start justify-start text-white text-opacity-100 motion-safe:transition-colors',
                selectedRealtimeExample !== 'cursors' && 'text-opacity-65',
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
                <CursorIcon className="h-4 w-4" />
                <h3 className="font-mona text-base font-bold">Live cursors</h3>
              </div>

              <p className="ml-8">
                Share the position and status of multiple cursors across
                multiple clients.
              </p>
            </li>

            <li
              className={twMerge(
                'grid grid-flow-row items-start justify-start text-white text-opacity-100 motion-safe:transition-colors',
                selectedRealtimeExample !== 'location' && 'text-opacity-65',
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
                <LocationIcon className="h-4 w-4" />
                <h3 className="font-mona text-base font-bold">Location</h3>
              </div>

              <p className="ml-8">
                Listen to changes in the database regarding the position of a
                moving coordinate.
              </p>
            </li>

            <li
              className={twMerge(
                'grid grid-flow-row items-start justify-start text-white text-opacity-100 motion-safe:transition-colors',
                selectedRealtimeExample !== 'charts' && 'text-opacity-65',
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
                <BarChartIcon className="h-4 w-4" />
                <h3 className="font-mona text-base font-bold">Live charts</h3>
              </div>

              <p className="ml-8">
                Keep charts updated in Realtime by listening to changes in the
                database rather than polling at intervals.
              </p>
            </li>
          </ul>

          <CodeSnippet language="graphql" customStyle={{ minHeight: 300 }}>
            {realtimeCodeSnippets[selectedRealtimeExample]}
          </CodeSnippet>
        </div>
      </Container>

      <Container
        component="section"
        className="mt-12 lg:mt-28"
        slotProps={{ root: { className: 'overflow-hidden' } }}
      >
        <SectionHeading
          title="Data federation"
          subtitle="Nhost federates data from multiple sources into a single GraphQL API for any client to consume."
        />

        <Image
          src="/products/data-federation.svg"
          alt="Nhost being connected to data sources"
          width={1110}
          height={1110}
          className="mx-auto h-auto w-full max-w-lg scale-150 sm:scale-100 sm:object-none"
        />
      </Container>

      <Container component="section" className="mt-24">
        <SectionHeading title="And more..." className="max-w-lg" />

        <div className="mx-auto mt-16 grid max-w-xs grid-cols-1 content-start justify-start gap-6 sm:max-w-2xl sm:auto-rows-fr sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
          <Card className="relative grid grid-flow-row place-content-center place-items-center gap-4 sm:row-span-15">
            <div className="relative">
              <LineGrid className="object-top-left left-1/2 top-1/2 mx-auto h-40 w-40 -translate-y-1/2 -translate-x-1/2" />
              <Glow />
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
              subtitle="Build apps users love"
              slotProps={{ title: { component: 'h3' } }}
            />

            <Button href="https://app.nhost.io" className="mt-6">
              Start building <ArrowRightIcon />
            </Button>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8">
            <Image
              src="/products/database.svg"
              width={24}
              height={24}
              alt="A database"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Query with ease</h3>

              <p className="text-base text-white text-opacity-65">
                Filter, sort, order by group, aggregate, limit. All operations
                are supported out of the box.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-7">
            <Image
              src="/products/search.svg"
              width={24}
              height={24}
              alt="Magnifying glass"
              className="mx-auto"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Search</h3>

              <p className="text-base text-white text-opacity-65">
                Full text search via GraphQL is supported out of the box with
                Postgres.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8">
            <Image
              src="/products/hasura.svg"
              width={24}
              height={24}
              alt="Logo of Hasura"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Hasura GraphQL Engine</h3>

              <p className="text-base text-white text-opacity-65">
                The GraphQL API is powered by the Hasura GraphQL Engine which
                has support for Event Triggers, Actions, and more.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/checkmark.svg"
              width={24}
              height={24}
              alt="A checkmark in a circle"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">N+1 problem, solved</h3>

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
          <div className="grid grid-flow-row items-center justify-items-center gap-4">
            <div className="gradient-background rounded-full p-px">
              <p className="rounded-full bg-paper px-4.5 py-1.5">
                There is more
              </p>
            </div>

            <SectionHeading title="Other features" />
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
