import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import ArrowRightIcon from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { ServiceCard } from '@/components/common/ServiceCard'
import WorkflowSection from '@/components/home/WorkflowSection'
import Image from 'next/image'
import { ReactElement } from 'react'

export default function IndexPage() {
  return (
    <>
      <Container component="section">
        <div className="grid grid-flow-row justify-center gap-10 pt-25">
          <div className="grid max-w-2xl grid-flow-row gap-4 text-center">
            <h1 className="font-mona text-5xl font-bold">
              Build apps users{' '}
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">
                love
              </span>
            </h1>

            <p className="text-xl text-white text-opacity-65">
              Nhost is a backend as an open-source backend development platform
              enables <strong>developers</strong> to <strong>build</strong> and{' '}
              <strong>scale</strong> their web and mobile <strong>apps</strong>.
            </p>
          </div>

          <Button
            className="justify-self-center text-base"
            href="https://app.nhost.io/sign-up"
            target="_blank"
            rel="noopener noreferrer"
          >
            Start building <ArrowRightIcon />
          </Button>
        </div>
      </Container>

      <Container
        component="section"
        slotProps={{ root: { className: 'mt-14' } }}
        className="grid grid-flow-row justify-center gap-12 text-center"
      >
        <h2 className="text-base text-white text-opacity-65">
          Trusted by developers
        </h2>

        <div className="flex flex-row flex-wrap items-center justify-center gap-x-6 gap-y-6 lg:gap-x-12 lg:gap-y-8">
          <Image
            src="/brands/brand-hearst.svg"
            alt="Hearst Logo"
            width={139}
            height={18}
          />

          <Image
            src="/brands/brand-btg.svg"
            alt="BTG Pactual Logo"
            width={99}
            height={39}
          />

          <Image
            src="/brands/brand-wattpad.svg"
            alt="Wattpad Logo"
            width={117}
            height={26}
          />

          <Image
            src="/brands/brand-biogen.svg"
            alt="Biogen Logo"
            width={69}
            height={22}
          />

          <Image
            src="/brands/brand-hexagon.svg"
            alt="Hexagon Logo"
            width={121}
            height={20}
          />

          <Image
            src="/brands/brand-maze.svg"
            alt="Maze Logo"
            width={123}
            height={22}
          />

          <Image
            src="/brands/brand-productboard.svg"
            alt="Productboard Logo"
            width={171}
            height={22}
          />
        </div>
      </Container>

      <Container
        component="section"
        slotProps={{ root: { className: 'mt-40' } }}
        className="grid grid-flow-row gap-14"
      >
        <div className="grid grid-flow-row items-center justify-items-center gap-4">
          <div className="gradient-background rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              100% Open Source
            </p>
          </div>

          <div className="grid max-w-2xl grid-flow-row gap-4 text-center">
            <h2 className="font-mona text-5xl font-bold">
              Backend without limits
            </h2>

            <p className="text-xl font-normal text-white text-opacity-65">
              Get a database and backend configure and ready in minutes so you
              can focus on your app and your users.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
            href="/product/postgres"
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
            description="Instant Realtime GraphQL API based on your tables and columns in the database."
            href="/product/graphql"
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
            description="GraphQL API, Role-Based Permissions, Web Console, Event Triggers, Cron Jobs, and more."
            href="/product/hasura"
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
            title="Authentication"
            description="Sign in users with email, magic links, SMS, Google, Facebook, etc."
            href="/product/auth"
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
            title="Storage (with CDN)"
            description="Let users upload and download images, documents and other files."
            href="/product/storage"
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
            title="Serverless Functions"
            description="Run custom code using JavaScript and Typescript with infinite scale."
            href="/product/functions"
          />
        </div>
      </Container>

      <Container
        component="section"
        slotProps={{ root: { className: 'mt-40' } }}
        className="grid grid-flow-row gap-14"
      >
        <div className="grid grid-flow-row justify-center gap-10 pt-25">
          <div className="mx-auto grid max-w-2xl grid-flow-row gap-4 text-center">
            <h2 className="font-mona text-5xl font-bold">
              What you can build with Nhost
            </h2>

            <p className="text-xl font-normal text-white text-opacity-65">
              Get a database and backend configure and ready in minutes so you
              can focus on your app and your users.
            </p>
          </div>

          <Button
            className="justify-self-center text-base"
            href="https://app.nhost.io/sign-up"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more <ArrowRightIcon />
          </Button>
        </div>
      </Container>

      <WorkflowSection />
    </>
  )
}

IndexPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
