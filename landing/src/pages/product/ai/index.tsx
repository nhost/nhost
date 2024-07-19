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
import { AIHeroSection } from '@/components/ai/AIHeroSection'
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

export default function AIPage() {
  const [selectedExample, setSelectedExample] =
    useState<keyof typeof codeSnippets>('nhost.toml')

  return (
    <>
      <AIHeroSection />

      <Container
        component="section"
        className="mt-16 grid grid-flow-row gap-16 md:mt-32 md:gap-24"
        slotProps={{
          root: { className: 'overflow-hidden xl:overflow-visible' },
        }}
      >
        <div className="grid grid-flow-row justify-items-center gap-8">
          <SectionHeading
            title="Enhance your backend with AI integration"
            subtitle="Create and deploy AI-powered applications"
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
            href="https://docs.nhost.io/product/ai"
            rel="noopener noreferrer"
            target="_blank"
          >
            Explore the docs <ArrowRightIcon />
          </Button>
        </div>

        <div className="grid grid-cols-1 items-start justify-items-center gap-0 pb-12 xl:grid-cols-2 xl:justify-items-start xl:gap-6">
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
            <div className="relative z-10 grid grid-flow-col justify-around xl:justify-evenly">
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
              className="h-auto w-full"
            />

            <Image
              src="/common/logo-glow.svg"
              width={1220}
              height={1220}
              alt="Nhost Logo in a dark circle"
              className="absolute -top-32 left-0 right-0 z-0 mx-auto hidden h-auto w-full object-none xl:block"
            />
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <SectionHeading
          title="Use cases"
          subtitle="The AI Toolkit extends the Nhost stack providing AI super-powers to your application."
          className="max-w-xl"
          slotProps={{
            subtitle: {
              className: 'max-w-xl mx-auto',
            },
          }}
        />

        <div className="mx-auto mt-24 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
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
          subtitle="Graphite offers several key advantages by running alongside your Nhost stack"
          className="max-w-xl"
          slotProps={{
            subtitle: {
              className: 'max-w-xl mx-auto',
            },
          }}
        />

        <div className="mx-auto mt-24 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          <div className="flex flex-row items-start space-x-4">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">
                Integrates with your project permissions{' '}
              </h3>
              <p className="text-base text-white text-opacity-65">
                Fully integrated with your project&rsquo;s permissions scheme
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
              <h3 className="text-base font-bold">
                Automatically updated embeddings
              </h3>
              <p className="text-base text-white text-opacity-65">
                Generate embeddings and keep them up to date automatically
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
              <h3 className="text-base font-bold">Workflow</h3>
              <p className="text-base text-white text-opacity-65">
                Implement AI-powered workflows with no hassle
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
              <h3 className="text-base font-bold">Developer assistant</h3>
              <p className="text-base text-white text-opacity-65">
                Accelerate development speed with help of the Developer
                Assistant
              </p>
            </div>
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 hidden lg:mt-40">
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

        <div className="mx-auto mt-16 flex h-52 w-full max-w-5xl items-center justify-center rounded-xl border border-divider bg-paper">
          Video Placeholder
        </div>
      </Container>

      <ProductSection
        slotProps={{ root: { className: 'mt-24 lg:mt-20' } }}
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
        disabledLink="ai"
      />

      <CTASection />
    </>
  )
}

AIPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
