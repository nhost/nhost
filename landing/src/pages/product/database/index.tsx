import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { ExampleSelectorButton } from '@/components/common/ExampleSelectorButton'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import { DatabaseHeroSection } from '@/components/database/DatabaseHeroSection'
import { ProductSection } from '@/components/product/ProductSection'
import Image from 'next/image'
import { ReactElement, useEffect, useRef, useState } from 'react'

const videos = {
  insertData: `/videos/database/insert-data.mp4`,
  editData: `/videos/database/edit-data.mp4`,
  createTable: `/videos/database/create-table.mp4`,
  editTable: `/videos/database/edit-table.mp4`,
}

const standaloneSnippet = `$ psql -h subdomain.db.eu-central-1.nhost\\
> -p 5432\\
> -U postgres\\
> -d database`

export default function DatabasePage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [selectedExample, setSelectedExample] =
    useState<keyof typeof videos>('insertData')

  useEffect(() => {
    if (!videoRef.current) {
      return
    }

    videoRef.current.load()
  }, [selectedExample])

  return (
    <>
      <DatabaseHeroSection />

      <Container
        component="section"
        className="mt-16 grid grid-flow-row gap-16 md:mt-28 md:gap-24"
        slotProps={{
          root: { className: 'overflow-hidden xl:overflow-visible' },
        }}
      >
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background mb-2 rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              User-friendly interface
            </p>
          </div>

          <SectionHeading
            title={<>Database admin, simplified</>}
            subtitle="Control your database with an intuitive interface. Create tables, manage relationships, and edit data - all without writing SQL. Perfect for both developers and non-technical team members."
            className="max-w-2xl"
          />
        </div>

        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-start justify-items-center">
          <div className="relative order-2 h-0 w-full overflow-hidden rounded-lg border border-divider pb-[56.25%] shadow-lg">
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              controls
              className="absolute top-0 left-0 h-full w-full rounded-lg"
            >
              <source src={`${videos[selectedExample]}`} type="video/mp4" />
            </video>
          </div>

          <div className="relative order-1 w-full max-w-3xl">
            <div className="relative z-10 grid grid-flow-col justify-around">
              <ExampleSelectorButton
                active={selectedExample === 'insertData'}
                onClick={() => setSelectedExample('insertData')}
              >
                Insert data
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'editData'}
                onClick={() => setSelectedExample('editData')}
              >
                Edit data
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'createTable'}
                onClick={() => setSelectedExample('createTable')}
              >
                Create table
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'editTable'}
                onClick={() => setSelectedExample('editTable')}
              >
                Edit table
              </ExampleSelectorButton>
            </div>

            <Image
              src="/products/connector-lines.svg"
              alt="Dashed lines"
              width={506}
              height={97}
              className="h-auto w-full"
            />
          </div>
        </div>
        {/* <div className="mx-auto mt-4 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
            <h3 className="text-sm font-bold">Visual schema builder</h3>
            <p className="mt-1 text-xs text-white text-opacity-65">
              Create and modify database tables and relationships with a simple
              visual interface
            </p>
          </div>
          <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
            <h3 className="text-sm font-bold">Spreadsheet-like experience</h3>
            <p className="mt-1 text-xs text-white text-opacity-65">
              Insert and edit data with familiar spreadsheet controls for
              maximum productivity
            </p>
          </div>
          <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
            <h3 className="text-sm font-bold">No SQL required</h3>
            <p className="mt-1 text-xs text-white text-opacity-65">
              Manage your entire database without writing a single line of SQL
              (but you still can if you want to)
            </p>
          </div>
        </div> */}
        <div className="mx-auto mt-4 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
            <h3 className="text-sm font-bold">Fast setup</h3>
            <p className="mt-1 text-xs text-white text-opacity-65">
              Deploy a production-ready PostgreSQL database in one minute.
            </p>
          </div>
          <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
            <h3 className="text-sm font-bold">Scalability</h3>
            <p className="mt-1 text-xs text-white text-opacity-65">
              Seamlessly scale your database as your application grows.​
            </p>
          </div>
          <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
            <h3 className="text-sm font-bold">High availability</h3>
            <p className="mt-1 text-xs text-white text-opacity-65">
              Ensure uptime with automated backups and failover mechanisms.​
            </p>
          </div>
          <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
            <h3 className="text-sm font-bold">Security</h3>
            <p className="mt-1 text-xs text-white text-opacity-65">
              Benefit from built-in encryption, authentication, and
              authorization features.
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
            <p className="rounded-full bg-paper px-4.5 py-1.5">Full control</p>
          </div>

          <SectionHeading
            title="PostgreSQL with root access"
            subtitle="Connect directly to your PostgreSQL instance using your favorite tools, run custom queries, and maintain complete control over your database."
            className="max-w-2xl"
          />
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <CodeSnippet language="bash" className="shadow-lg">
              {standaloneSnippet}
            </CodeSnippet>

            <div className="rounded-lg border border-divider bg-paper p-5">
              <h3 className="mb-2 text-lg font-bold">
                Direct Database Connection
              </h3>
              <p className="text-sm text-white text-opacity-80">
                Connect using the standard{' '}
                <code className="rounded-sm bg-black bg-opacity-30 px-1 py-0.5 text-xs">
                  psql
                </code>{' '}
                command-line tool or any PostgreSQL client. Full root access
                means you can create extensions, run complex queries, and
                perform advanced database operations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 content-start gap-4">
            <div className="rounded-lg border border-divider bg-paper p-5 shadow-md">
              <h3 className="mb-2 text-base font-bold">
                Use your favorite tools
              </h3>
              <p className="text-sm text-white text-opacity-65">
                Connect using pgAdmin, DBeaver, DataGrip, or any other
                PostgreSQL client. Work with the tools you&apos;re already
                comfortable with.
              </p>
            </div>

            <div className="rounded-lg border border-divider bg-paper p-5 shadow-md">
              <h3 className="mb-2 text-base font-bold">
                Custom PostgreSQL extensions
              </h3>
              <p className="text-sm text-white text-opacity-65">
                Install and configure any PostgreSQL extension you need, from
                PostGIS for geospatial data to pgvector for AI embeddings.
              </p>
            </div>

            <div className="rounded-lg border border-divider bg-paper p-5 shadow-md">
              <h3 className="mb-2 text-base font-bold">
                Complex Queries and procedures
              </h3>
              <p className="text-sm text-white text-opacity-65">
                Write and execute complex SQL queries, create stored procedures,
                and leverage the full power of PostgreSQL&apos;s advanced
                features.
              </p>
            </div>
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background mb-2 rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Enterprise-ready
            </p>
          </div>

          <SectionHeading
            title="Everything you need"
            subtitle="Worry-free database hosting with all the features required for production applications. Focus on building your app while we handle the infrastructure."
            className="max-w-2xl"
          />
        </div>

        <div className="mx-auto mt-12 grid max-w-xs grid-cols-1 content-start justify-start gap-6 sm:max-w-2xl sm:auto-rows-fr sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
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
              subtitle="Build apps users trust"
              slotProps={{ title: { component: 'h3' } }}
            />

            <Button href="https://app.nhost.io" className="mt-6">
              Start building <ArrowRightIcon />
            </Button>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8">
            <Image
              src="/products/postgres.svg"
              width={24}
              height={24}
              alt="PostgreSQL logo"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">PostgreSQL extensions</h3>

              <p className="text-base text-white text-opacity-65">
                Access a comprehensive library of PostgreSQL extensions for
                specialized functionality - from full-text search to geospatial
                data and more.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-7">
            <Image
              src="/products/backups.svg"
              width={24}
              height={24}
              alt="Backup icon"
              className="mx-auto"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Automatic backups</h3>

              <p className="text-base text-white text-opacity-65">
                Daily automated backups and point-in-time recovery capabilities.
                Restore your database to any moment in time with just a few
                clicks.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8">
            <Image
              src="/products/bulls-eye.svg"
              width={24}
              height={24}
              alt="Target icon"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">High-performance storage</h3>

              <p className="text-base text-white text-opacity-65">
                All databases run on enterprise-grade NVMe SSDs for
                lightning-fast performance. Optimized infrastructure designed
                for demanding workloads.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/logs.svg"
              width={24}
              height={24}
              alt="Logs icon"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Comprehensive logging</h3>

              <p className="text-base text-white text-opacity-65">
                Access detailed database logs for monitoring, troubleshooting,
                and performance optimization. Full visibility into your database
                operations.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/resize.svg"
              width={24}
              height={24}
              alt="Scaling icon"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Seamless scaling</h3>

              <p className="text-base text-white text-opacity-65">
                Start small and scale as you grow. Easily upgrade your database
                resources as your application&apos;s needs increase.
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
              subtitle="A Postgres database is just one part of our backend stack. Discover how all our services work together to power your applications."
            />
          </div>
        }
        disabledLink="database"
      />

      <CTASection />
    </>
  )
}

DatabasePage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
