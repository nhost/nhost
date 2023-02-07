import { Button } from '@/components/common/Button'
import Card from '@/components/common/Card'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { ExampleSelectorButton } from '@/components/common/ExampleSelectorButton'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ProductSection } from '@/components/product/ProductSection'
import Image from 'next/image'
import { ReactElement, useEffect, useRef, useState } from 'react'

const videos = {
  insertData: `insert-data.mp4`,
  editData: ``,
  createTable: `create-table.mp4`,
  editTable: ``,
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
      <Container
        component="section"
        className="grid grid-cols-1 gap-14 py-8 sm:grid-cols-2 sm:gap-6 sm:py-24"
      >
        <div className="grid grid-flow-row content-center justify-start justify-items-start gap-4 lg:px-28">
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

      <Container
        component="section"
        className="grid grid-flow-row gap-24"
        slotProps={{ root: { className: 'overflow-hidden' } }}
      >
        <SectionHeading
          title="Database admin, simplified"
          subtitle="Control your database like a spreadsheet."
        />

        <div className="grid grid-cols-1 items-center justify-items-center gap-0 xl:grid-cols-2 xl:justify-items-start xl:gap-6">
          <div className="relative order-2 h-0 w-full pb-[56.25%] xl:order-1">
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              controls
              className="absolute top-0 left-0 h-full w-full rounded-lg"
            >
              <source
                src={`/videos/database/${videos[selectedExample]}`}
                type="video/mp4"
              />
            </video>
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
                active={selectedExample === 'editData'}
                onClick={() => setSelectedExample('editData')}
              >
                Edit Data
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'createTable'}
                onClick={() => setSelectedExample('createTable')}
              >
                Create Table
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'editTable'}
                onClick={() => setSelectedExample('editTable')}
              >
                Edit Table
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
              className="relative z-0 mx-auto -mt-48 hidden h-auto max-w-[470px] xl:block"
            />

            <Image
              src="/common/logo-glow.svg"
              width={1220}
              height={1220}
              alt="Nhost Logo in a dark circle"
              className="absolute bottom-0 left-0 right-0 z-0 mx-auto -mt-48 hidden h-auto max-w-[470px] animate-pulse xl:block"
            />
          </div>
        </div>
      </Container>

      <Container
        component="section"
        className="mt-24 lg:mt-40"
        slotProps={{ root: { className: 'overflow-hidden' } }}
      >
        <SectionHeading
          title="Postgres, with root access"
          subtitle="Do you prefer to write raw SQL and have full control of your database? No problem."
          className="max-w-lg"
        />

        <CodeSnippet
          slotProps={{ root: { className: 'mx-auto md:max-w-xl mt-28' } }}
        >
          {standaloneSnippet}
        </CodeSnippet>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <SectionHeading
          title="Everything you need"
          subtitle="Worry free database hosting with everything you need to be successful."
          className="max-w-lg"
        />

        <div className="mx-auto mt-8 grid max-w-xs grid-cols-1 content-start justify-start gap-6 sm:max-w-2xl sm:auto-rows-fr sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
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
              src="/products/postgres.svg"
              width={24}
              height={24}
              alt="A paper"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Postgres Extensions</h3>

              <p className="text-base text-white text-opacity-65">
                Choose from a huge collection of Postgres extensions.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-7">
            <Image
              src="/products/backups.svg"
              width={24}
              height={24}
              alt="A paper"
              className="mx-auto"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Automatic Backups</h3>

              <p className="text-base text-white text-opacity-65">
                Daily backups of your database.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8">
            <Image
              src="/products/secure.svg"
              width={24}
              height={24}
              alt="A paper"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Secure</h3>

              <p className="text-base text-white text-opacity-65">[todo]</p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/logs.svg"
              width={24}
              height={24}
              alt="A paper"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Logs</h3>

              <p className="text-base text-white text-opacity-65">
                Access raw database logs.
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
        disabledLink="database"
      />

      <CTASection />
    </>
  )
}

DatabasePage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
