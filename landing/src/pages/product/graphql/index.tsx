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
  insertData: `import { nhost } from './nhost'

const createNewUser = async () => {
  // Insert data with GraphQL mutation
  const { data, error } = await nhost.graphql.request(\`
    mutation InsertUser($user: users_insert_input!) {
      insert_users_one(object: $user) {
        id
        name
        email
        created_at
      }
    }
  \`, {
    variables: {
      user: {
        name: "John Doe",
        email: "john@example.com",
        profile: {
          data: {
            bio: "Software developer",
            avatar_url: "https://example.com/avatar.jpg"
          }
        }
      }
    }
  })
  
  if (error) {
    console.error("Error inserting user:", error)
    return
  }
  
  console.log("New user created:", data.insert_users_one)
}`,
  readData: `import { nhost } from './nhost'

const fetchUsers = async () => {
  // Fetch data with GraphQL query
  const { data, error } = await nhost.graphql.request(\`
    query GetUsers {
      users(
        order_by: { created_at: desc }
        where: { is_active: { _eq: true } }
        limit: 10
      ) {
        id
        name
        email
        profile {
          bio
          avatar_url
        }
        posts {
          id
          title
        }
      }
    }
  \`)
  
  if (error) {
    console.error("Error fetching users:", error)
    return
  }
  
  return data.users
}`,
  updateData: `import { nhost } from './nhost'

const updateUserProfile = async (userId, newBio) => {
  // Update data with GraphQL mutation
  const { data, error } = await nhost.graphql.request(\`
    mutation UpdateProfile($userId: uuid!, $bio: String!) {
      update_profiles(
        where: { user_id: { _eq: $userId } },
        _set: { bio: $bio }
      ) {
        affected_rows
        returning {
          id
          bio
          updated_at
        }
      }
    }
  \`, {
    variables: {
      userId,
      bio: newBio
    }
  })
  
  if (error) {
    console.error("Error updating profile:", error)
    return
  }
  
  console.log("Profile updated:", data.update_profiles.returning[0])
}`,
  deleteData: `import { nhost } from './nhost'

const deleteUser = async (userId) => {
  // Delete data with GraphQL mutation
  const { data, error } = await nhost.graphql.request(\`
    mutation DeleteUser($userId: uuid!) {
      delete_users(where: { id: { _eq: $userId } }) {
        affected_rows
      }
      # Cascading delete due to foreign key relationships
      delete_profiles(where: { user_id: { _eq: $userId } }) {
        affected_rows
      }
    }
  \`, {
    variables: {
      userId
    }
  })
  
  if (error) {
    console.error("Error deleting user:", error)
    return
  }
  
  console.log("User deleted, rows affected:", data.delete_users.affected_rows)
}`,
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
        className="grid grid-flow-row gap-16 md:gap-24 mt-16"
        slotProps={{
          root: { className: 'overflow-hidden xl:overflow-visible' },
        }}
      >
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background rounded-full p-px mb-2">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Developer Experience
            </p>
          </div>
          
          <SectionHeading
            title={
              <>
                Type-safe <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">GraphQL API</span>
              </>
            }
            subtitle="Nhost GraphQL Client is tailored to your GraphQL API. The auto-completion helps you build queries faster with fewer errors and without constantly checking documentation."
          />

          <Button
            variant="outlined"
            className="text-base font-bold"
            href="https://docs.nhost.io/graphql/client"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore the docs <ArrowRightIcon />
          </Button>
        </div>

        <div className="grid grid-cols-1 items-center justify-items-center gap-8 pb-12 xl:grid-cols-2 xl:justify-items-start xl:gap-6">
          <div className="order-2 w-full xl:order-1">
            <CodeSnippet
              language="typescript"
              className="min-h-[330px] shadow-lg"
              slotProps={{ root: { className: 'mx-auto md:max-w-xl animate-fade-in-delay' } }}
            >
              {codeSnippets[selectedExample]}
            </CodeSnippet>
            
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 max-w-xl mx-auto">
              <div className="p-4 rounded-md bg-paper border border-divider bg-opacity-50">
                <h3 className="text-sm font-bold">Type Safe</h3>
                <p className="text-xs text-white text-opacity-65 mt-1">Full TypeScript support for a better development experience</p>
              </div>
              <div className="p-4 rounded-md bg-paper border border-divider bg-opacity-50">
                <h3 className="text-sm font-bold">Auto-generated SDK</h3>
                <p className="text-xs text-white text-opacity-65 mt-1">SDK generated from your GraphQL schema for perfect type safety</p>
              </div>
            </div>
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
              className="absolute top-11 left-0 right-0 z-0 mx-auto hidden h-auto w-full max-w-[280px] object-none xl:block animate-pulse"
            />
          </div>
        </div>
      </Container>

      <Container component="section" className="pt-28 mt-8">
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background rounded-full p-px mb-2">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Enterprise-Grade Security
            </p>
          </div>
          
          <SectionHeading
            title={
              <>
                Powerful <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Permissions</span>, Made Simple
              </>
            }
            subtitle="Row and column level permissions to safely expose your GraphQL API to the world. Control exactly what data users can access without writing complex authorization code."
            className="max-w-2xl"
            slotProps={{ subtitle: { className: 'max-w-lg mx-auto' } }}
          />
        </div>

        <div className="mx-auto mt-16 flex w-full max-w-5xl items-center justify-center rounded-xl border border-divider bg-paper shadow-lg">
          <video autoPlay loop muted controls className="rounded-lg">
            <source src={`/videos/graphql/permissions.mp4`} type="video/mp4" />
          </video>
        </div>
        
        <div className="mt-12 grid grid-cols-2 gap-6 max-w-5xl mx-auto">
          <div className="p-6 rounded-lg bg-paper border border-divider shadow-md">
            <h3 className="text-lg font-bold mb-3">Row-Level Security</h3>
            <p className="text-base text-white text-opacity-65">Control which rows users can access based on their identity or role. Ensure users only see their own data or data specifically shared with them.</p>
          </div>
          
          <div className="p-6 rounded-lg bg-paper border border-divider shadow-md">
            <h3 className="text-lg font-bold mb-3">Column-Level Security</h3>
            <p className="text-base text-white text-opacity-65">Hide sensitive fields from unauthorized users. Protect personal information while still allowing access to other data in the same table.</p>
          </div>
        </div>
      </Container>

      <Container
        component="section"
        className="mt-24 pb-12 lg:mt-40"
        slotProps={{ root: { className: 'overflow-hidden' } }}
      >
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background rounded-full p-px mb-2">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Build Collaborative Apps
            </p>
          </div>
          
          <SectionHeading
            title={
              <>
                Realtime <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Subscriptions</span>
              </>
            }
            subtitle="Create modern, collaborative applications with GraphQL subscriptions. Get live data updates pushed to your client in real-time without complex WebSocket setup."
          />
        </div>

        <div className="mx-auto mt-12 grid items-start gap-12 md:grid-cols-2 lg:mt-24 lg:max-w-5xl">
          <ul className="grid grid-flow-row gap-6 md:max-w-sm">
            <li
              className={twMerge(
                'grid grid-flow-row items-start justify-start text-white text-opacity-100 motion-safe:transition-colors p-4 rounded-lg border border-transparent',
                selectedRealtimeExample === 'avatars' ? 'border-brand-main bg-paper bg-opacity-40' : 'text-opacity-65 hover:text-opacity-100',
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
                <h3 className="font-mona text-base font-bold">Live Avatars</h3>
              </div>

              <p className="ml-8 mt-2 text-sm">
                Show online status and user presence in real-time across multiple clients. Perfect for chat applications and collaborative workspaces.
              </p>
            </li>

            <li
              className={twMerge(
                'grid grid-flow-row items-start justify-start text-white text-opacity-100 motion-safe:transition-colors p-4 rounded-lg border border-transparent',
                selectedRealtimeExample === 'cursors' ? 'border-brand-main bg-paper bg-opacity-40' : 'text-opacity-65 hover:text-opacity-100',
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
                <h3 className="font-mona text-base font-bold">Live Cursors</h3>
              </div>

              <p className="ml-8 mt-2 text-sm">
                Create Google Docs-like experiences with multi-user cursor positions updated in real-time. Enable truly collaborative document editing.
              </p>
            </li>

            <li
              className={twMerge(
                'grid grid-flow-row items-start justify-start text-white text-opacity-100 motion-safe:transition-colors p-4 rounded-lg border border-transparent',
                selectedRealtimeExample === 'location' ? 'border-brand-main bg-paper bg-opacity-40' : 'text-opacity-65 hover:text-opacity-100',
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
                <h3 className="font-mona text-base font-bold">Live Location</h3>
              </div>

              <p className="ml-8 mt-2 text-sm">
                Build location-tracking applications with real-time updates. Perfect for delivery tracking, ride-sharing, or fleet management apps.
              </p>
            </li>

            <li
              className={twMerge(
                'grid grid-flow-row items-start justify-start text-white text-opacity-100 motion-safe:transition-colors p-4 rounded-lg border border-transparent',
                selectedRealtimeExample === 'charts' ? 'border-brand-main bg-paper bg-opacity-40' : 'text-opacity-65 hover:text-opacity-100',
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
                <h3 className="font-mona text-base font-bold">Live Charts</h3>
              </div>

              <p className="ml-8 mt-2 text-sm">
                Create dashboards with real-time data visualization. Get instant updates without polling, perfect for analytics, monitoring, and IoT applications.
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
            
            <div className="bg-paper p-4 rounded-lg border border-divider">
              <h4 className="font-bold mb-2 text-sm">Why Subscriptions Matter</h4>
              <p className="text-sm text-white text-opacity-65">
                Unlike traditional REST APIs that require polling, GraphQL subscriptions push data to clients only when changes occur, reducing server load and improving user experience with real-time updates.
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
          <div className="gradient-background rounded-full p-px mb-2">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Unified Data Access
            </p>
          </div>
          
          <SectionHeading
            title={
              <>
                Data <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Federation</span>
              </>
            }
            subtitle="Connect multiple data sources into a single, unified GraphQL API. Combine your database with third-party services, microservices, and legacy systems - all through one powerful API."
          />
        </div>

        <div className="relative mt-16">
          <Glow className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1/2 w-1/2 opacity-40 blur-3xl animate-pulse" />
          
          <Image
            src="/products/data-federation.svg"
            alt="Nhost being connected to data sources"
            width={1110}
            height={1110}
            className="mx-auto h-auto w-full max-w-2xl relative z-10 animate-fade-in-delay"
          />
        </div>
        
        <div className="mt-12 grid grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="p-6 rounded-lg bg-paper border border-divider shadow-md">
            <h3 className="text-lg font-bold mb-3">Single API</h3>
            <p className="text-sm text-white text-opacity-65">Access all your data through a single, consistent GraphQL API, eliminating the need to manage multiple endpoints.</p>
          </div>
          
          <div className="p-6 rounded-lg bg-paper border border-divider shadow-md">
            <h3 className="text-lg font-bold mb-3">Remote Schemas</h3>
            <p className="text-sm text-white text-opacity-65">Connect third-party REST APIs and other GraphQL services directly into your main API with remote schemas.</p>
          </div>
          
          <div className="p-6 rounded-lg bg-paper border border-divider shadow-md">
            <h3 className="text-lg font-bold mb-3">Cross-Source Joins</h3>
            <p className="text-sm text-white text-opacity-65">Join data across different sources in a single query, combining information from your database with external services.</p>
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background rounded-full p-px mb-2">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              More Capabilities
            </p>
          </div>
          
          <SectionHeading
            title={
              <>
                Advanced <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">GraphQL</span> Features
              </>
            }
            subtitle="Everything you need for modern, high-performance APIs all in one platform."
            className="max-w-2xl"
          />
        </div>

        <div className="mx-auto mt-16 grid max-w-xs grid-cols-1 content-start justify-start gap-6 sm:max-w-2xl sm:auto-rows-fr sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
          <Card className="relative grid grid-flow-row place-content-center place-items-center gap-4 sm:row-span-15 shadow-lg transition-all duration-300 hover:shadow-xl">
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
          
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8 shadow-lg transition-all duration-300 hover:shadow-xl">
            <Image
              src="/products/database.svg"
              width={24}
              height={24}
              alt="A database"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Advanced Querying</h3>

              <p className="text-base text-white text-opacity-65">
                Filter, sort, order by, group, aggregate, limit, and offset. Express complex queries with a clean, type-safe GraphQL API without writing any backend code.
              </p>
            </div>
          </Card>
          
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-7 shadow-lg transition-all duration-300 hover:shadow-xl">
            <Image
              src="/products/search.svg"
              width={24}
              height={24}
              alt="Magnifying glass"
              className="mx-auto"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Full-Text Search</h3>

              <p className="text-base text-white text-opacity-65">
                Powerful full-text search capabilities built right into your GraphQL API. No need to set up and manage a separate search engine.
              </p>
            </div>
          </Card>
          
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8 shadow-lg transition-all duration-300 hover:shadow-xl">
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
                Enterprise-grade GraphQL engine with support for Event Triggers, Actions, Remote Schemas and more. Mature, battle-tested technology powering thousands of production apps.
              </p>
            </div>
          </Card>
          
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8 lg:row-span-7 shadow-lg transition-all duration-300 hover:shadow-xl">
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
                All your GraphQL queries are intelligently compiled into optimized SQL queries, solving the common N+1 performance problem that plagues many GraphQL implementations.
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
                Complete Backend Platform
              </p>
            </div>

            <SectionHeading 
              title="Explore the Nhost Ecosystem" 
              subtitle="GraphQL is just one part of our complete backend platform. Discover how all our services work together to power your applications."
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
