import { Button } from '@/components/common/Button'
import Card from '@/components/common/Card'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ProductSection } from '@/components/product/ProductSection'
import Image from 'next/image'
import { ReactElement, useState } from 'react'

const codeSnippets = {
  insertData: ``,
  editData: ``,
  createTable: ``,
  editTable: ``,
}

const standaloneSnippet = `$ psql -h subdomain.db.eu-central-1.nhost\\
> -p 5432\\
> -U postgres\\
> -d database`

type DatabaseSnippets = typeof codeSnippets

export default function DatabasePage() {
  const [selectedSnippet, setSelectedSnippet] =
    useState<keyof DatabaseSnippets>('insertData')

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

      <Container component="section" className="grid grid-flow-row gap-24">
        <SectionHeading
          title="Database admin, simplified"
          subtitle="Control your database like a spreadsheet."
        />

        <div className="grid grid-flow-col gap-6">
          <div>
            <CodeSnippet
              className="min-h-[330px]"
              slotProps={{ root: { className: 'mx-auto md:max-w-xl' } }}
            >
              {codeSnippets[selectedSnippet]}
            </CodeSnippet>
          </div>

          <div>B</div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
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
                className="w-26 h-26 relative z-10"
              />
            </div>

            <SectionHeading
              title="Nhost"
              subtitle="Build apps users love"
              slotProps={{ title: { component: 'h3' } }}
            />

            <Button href="https://app.nhost.io/signup" className="mt-6">
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
                Choose from a huge collection of Postgres extensions, enabled
                with a single click.
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
                Choose from a huge collection of Postgres extensions, enabled
                with a single click.
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

              <p className="text-base text-white text-opacity-65">
                Choose from a huge collection of Postgres extensions, enabled
                with a single click.
              </p>
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
                Choose from a huge collection of Postgres extensions, enabled
                with a single click.
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
