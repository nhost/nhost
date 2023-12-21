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
import { GraphiteHeroSection } from '@/components/graphite/GraphiteHeroSection'
import { ProductSection } from '@/components/product/ProductSection'
import { RunHeroSection } from '@/components/run/RunHeroSection'
import Image from 'next/image'
import { ReactElement, useState } from 'react'

const codeSnippets = {
  'nhost.toml': {
    snippet: `[ai​]
version = '0.1.0'
webhookSecret = '{{ secrets.GRAPHITE_WEBHOOK_SECRET }}'

[ai.autoEmbeddings​]
synchPeriodMinutes = 5

[ai.openai​]
apiKey = '{{ secrets.OPEANAI_API_KEY }}'
organization = 'my-org'

[ai.resources.compute​]
cpu = 125
memory = 256`,
    lang: 'toml',
  },
  'auto-embeddings.gql': {
    snippet: `query {
      graphiteSearchMovies(
        args: {
          query: "comedy in space",
          amount: 5
        }
      ) {
        name
        overview
        genre
      }
    }`,
    lang: 'graphql',
  },
  'assistant.gql': {
    snippet: `
    mutation {
      graphite{
        sendMessage(
          sessionID: "thread_TJ1ImA9kpToCioJvOEJuHeuD",
          message: "can you recommend me a thrilling space opera?",
          prevMessageId: "msg_FAhHm3HYL87gPhuvh4wwnRl6",
        ) {
          sessionId
          messages {
            id
            message
          }
        }
      }
    }`,
    lang: 'graphql',
  },
}

export default function GraphitePage() {
  const [selectedExample, setSelectedExample] =
    useState<keyof typeof codeSnippets>('nhost.toml')

  return (
    <>
      <GraphiteHeroSection />

      <Container
        component="section"
        className="grid grid-flow-row gap-16 mt-16 md:mt-32 md:gap-24"
        slotProps={{
          root: { className: 'overflow-hidden xl:overflow-visible' },
        }}
      >
        <div className="grid grid-flow-row gap-8 justify-items-center">
          <SectionHeading
            title="Enhance your backend with AI integration"
            subtitle="Create and deploy AI-powered assistants"
            className="max-w-xl"
            slotProps={{
              subtitle: {
                className: 'max-w-xl mx-auto',
              },
            }}
          />

          <Button
            variant="borderless"
            className="text-base font-bold"
            size="sm"
            href="https://docs.nhost.io/graphite"
            rel="noopener noreferrer"
            target="_blank"
          >
            Explore the docs <ArrowRightIcon />
          </Button>
        </div>

        <div className="grid items-start grid-cols-1 gap-0 pb-12 justify-items-center xl:grid-cols-2 xl:justify-items-start xl:gap-6">
          <div className="order-2 w-full xl:order-1">
            <CodeSnippet
              language={codeSnippets[selectedExample].lang}
              customStyle={{ minHeight: 220 }}
              slotProps={{ root: { className: 'mx-auto md:max-w-xl' } }}
            >
              {codeSnippets[selectedExample].snippet}
            </CodeSnippet>
          </div>

          <div className="relative order-1 w-full max-w-3xl xl:order-2">
            <div className="relative z-10 grid justify-around grid-flow-col xl:justify-evenly">
              <ExampleSelectorButton
                active={selectedExample === 'nhost.toml'}
                onClick={() => setSelectedExample('nhost.toml')}
              >
                nhost.toml
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'auto-embeddings.gql'}
                onClick={() => setSelectedExample('auto-embeddings.gql')}
              >
                auto-embeddings.gql
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'assistant.gql'}
                onClick={() => setSelectedExample('assistant.gql')}
              >
                assistant.gql
              </ExampleSelectorButton>
            </div>

            <Image
              src="/common/connectors/run-example-connectors.svg"
              alt="Dashed lines"
              width={608}
              height={97}
              className="w-full h-auto"
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

      <Container component="section" className="mt-24 lg:mt-40">
        <SectionHeading
          title="Use cases"
          subtitle="Graphite extends the Nhost stack providing AI super-powers to your application."
          className="max-w-xl"
          slotProps={{
            subtitle: {
              className: 'max-w-xl mx-auto',
            },
          }}
        />

        <div className="grid max-w-4xl grid-cols-1 gap-4 mx-auto mt-24 md:grid-cols-3">
          <Card className="flex flex-col space-y-3">
            <Image
              src="/products/auto-embeddings.svg"
              width={24}
              height={24}
              alt="Globe"
            />
            <h3 className="text-base font-bold">Auto-Embeddings</h3>
            <p className="text-base text-white text-opacity-65">
              Generate embeddings for your data automatically as it is inserted
              or modified.
            </p>
          </Card>

          <Card className="flex flex-col space-y-3">
            <Image
              src="/products/ai-assistants.svg"
              width={24}
              height={24}
              alt="Globe"
            />
            <h3 className="text-base font-bold">AI Assistants</h3>
            <p className="text-base text-white text-opacity-65">
              Create AI assistants so your users can interact with your data
              using AI.
            </p>
          </Card>

          <Card className="flex flex-col space-y-3">
            <Image
              src="/products/graphite-logo.svg"
              width={24}
              height={24}
              alt="Globe"
            />
            <h3 className="text-base font-bold">Developer Assistant</h3>
            <p className="text-base text-white text-opacity-65">
              Custom AI assistant with access to your project’s information
              (i.e. database/graphql schema)
            </p>
          </Card>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <SectionHeading
          title="Advantages"
          subtitle="Nhost Run offers several key advantages by running workloads alongside your project"
          className="max-w-xl"
          slotProps={{
            subtitle: {
              className: 'max-w-xl mx-auto',
            },
          }}
        />

        <div className="grid max-w-4xl grid-cols-1 gap-8 mx-auto mt-24 md:grid-cols-2">
          <div className="flex flex-row items-start space-x-4">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">Minimal Latency</h3>
              <p className="text-base text-white text-opacity-65">
                Communication and data exchange between different components of
                your project occur quickly and efficiently.
              </p>
            </div>
          </div>

          <div className="flex flex-row items-start space-x-4">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">No Egress Costs</h3>
              <p className="text-base text-white text-opacity-65">
                No additional egress costs for transferring data between
                different components of your project.
              </p>
            </div>
          </div>

          <div className="flex flex-row items-start space-x-4">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">Improved Reliability</h3>
              <p className="text-base text-white text-opacity-65">
                Your workloads continue to function even in scenarios where
                internet access may be limited or disrupted.
              </p>
            </div>
          </div>

          <div className="flex flex-row items-start space-x-4">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">Integrated Operations</h3>
              <p className="text-base text-white text-opacity-65">
                Develop, build, manage, and scale your own workloads the same
                way that you manage your Nhost Project.
              </p>
            </div>
          </div>
        </div>
      </Container>

      <Container component="section" className="hidden mt-24 lg:mt-40">
        <SectionHeading
          title="Powerful permissions, made simple"
          subtitle="Storage permissions work like any other data in your database. Use Buckets to segment files."
          className="max-w-2xl"
          slotProps={{
            subtitle: {
              className: 'max-w-lg mx-auto',
            },
          }}
        />

        <div className="flex items-center justify-center w-full max-w-5xl mx-auto mt-16 border h-52 rounded-xl border-divider bg-paper">
          Video Placeholder
        </div>
      </Container>

      <Container component="section" className="mt-24">
        <SectionHeading title="And more..." className="max-w-lg" />

        <div className="grid content-start justify-start max-w-xs grid-cols-1 gap-6 mx-auto mt-16 sm:max-w-2xl sm:auto-rows-fr sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
          <Card className="relative grid grid-flow-row gap-4 place-content-center place-items-center sm:row-span-15">
            <div className="relative">
              <LineGrid className="w-40 h-40 mx-auto -translate-x-1/2 -translate-y-1/2 object-top-left left-1/2 top-1/2" />
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

            <Button href="https://app.nhost.io/uploadFile" className="mt-6">
              Start building <ArrowRightIcon />
            </Button>
          </Card>
          <Card className="grid grid-flow-row gap-4 text-center place-content-center place-items-center sm:row-span-8">
            <Image
              src="/products/globe.svg"
              width={24}
              height={24}
              alt="Globe"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Private Registry</h3>

              <p className="text-base text-white text-opacity-65">
                Push your service images to our private registry with
                deployments or using our CLI
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row gap-4 text-center place-content-center place-items-center sm:row-span-7">
            <Image
              src="/products/code.svg"
              width={24}
              height={24}
              alt="Resize icon"
              className="mx-auto"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Your Favourite Languages</h3>

              <p className="text-base text-white text-opacity-65">
                Run services written in JS/TS, Go, Python, etc
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row gap-4 text-center place-content-center place-items-center sm:row-span-8">
            <Image
              src="/products/maximize.svg"
              width={24}
              height={24}
              alt="Full screen icon"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">High Scalability</h3>

              <p className="text-base text-white text-opacity-65">
                Use Dedicated Compute and Service Replicas to scale your custom
                Services.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row gap-4 text-center place-content-center place-items-center sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/arrows-clockwise.svg"
              width={24}
              height={24}
              alt="A box"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Integrated CI</h3>

              <p className="text-base text-white text-opacity-65">
                Coming soon
              </p>
            </div>
          </Card>
        </div>
      </Container>

      <ProductSection
        slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
        heading={
          <div className="grid items-center grid-flow-row gap-4 justify-items-center">
            <div className="p-px rounded-full gradient-background">
              <p className="rounded-full bg-paper px-4.5 py-1.5">
                There is more
              </p>
            </div>

            <SectionHeading title="Other features" />
          </div>
        }
        disabledLink="run"
      />

      <CTASection />
    </>
  )
}

GraphitePage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
