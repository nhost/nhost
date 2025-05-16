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
          <div className="gradient-background mb-6 animate-fade-in rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5 text-sm">
              AI-powered backend
            </p>
          </div>
          <SectionHeading
            title="Enhance your backend with AI integration"
            subtitle="Create and deploy AI-powered applications with a few lines of configuration"
            className="max-w-xl"
            slotProps={{
              subtitle: {
                className: 'max-w-xl mx-auto',
              },
            }}
          />

          <Button
            variant="borderless"
            className="animate-fade-in text-base font-bold"
            size="sm"
            href="https://docs.nhost.io/products/ai/overview"
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
              slotProps={{
                root: { className: 'mx-auto md:max-w-xl animate-fade-in' },
              }}
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
              className="h-auto w-full animate-fade-in"
            />

            <Image
              src="/common/logo-glow.svg"
              width={1220}
              height={1220}
              alt="Nhost Logo in a dark circle"
              className="absolute -top-32 left-0 right-0 z-0 mx-auto hidden h-auto w-full animate-pulse object-none xl:block"
            />
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="gradient-background mx-auto mb-6 w-fit animate-fade-in rounded-full p-px">
          <p className="rounded-full bg-paper px-4.5 py-1.5 text-sm">
            AI for everyone
          </p>
        </div>
        <SectionHeading
          title="Use cases for every application"
          subtitle="The AI Toolkit extends the Nhost stack providing AI super-powers to your application."
          className="max-w-xl"
          slotProps={{
            subtitle: {
              className: 'max-w-xl mx-auto',
            },
          }}
        />

        <div className="mx-auto mt-24 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="hover:shadow-glow-sm flex flex-col space-y-3 transition-all">
            <Image
              src="/products/auto-embeddings.svg"
              width={24}
              height={24}
              alt="Auto-Embeddings icon"
              className="transition-all group-hover:scale-110"
            />
            <h3 className="text-base font-bold">Auto-Embeddings</h3>
            <p className="text-base text-white text-opacity-65">
              Generate embeddings for your data automatically as it is inserted
              or modified, enabling powerful semantic search capabilities.
            </p>
          </Card>

          <Card className="hover:shadow-glow-sm flex flex-col space-y-3 transition-all">
            <Image
              src="/products/ai-assistants.svg"
              width={24}
              height={24}
              alt="AI Assistants icon"
              className="transition-all group-hover:scale-110"
            />
            <h3 className="text-base font-bold">AI Agents</h3>
            <p className="text-base text-white text-opacity-65">
              Create customized AI assistants so your users can interact with
              your data using natural language and get intelligent responses.
            </p>
          </Card>

          <Card className="hover:shadow-glow-sm flex flex-col space-y-3 transition-all">
            <Image
              src="/products/graphite-logo.svg"
              width={24}
              height={24}
              alt="Developer Assistant icon"
              className="transition-all group-hover:scale-110"
            />
            <h3 className="text-base font-bold">Developer Assistant</h3>
            <p className="text-base text-white text-opacity-65">
              Boost your development speed with a custom AI assistant that has
              access to your project&apos;s information like database and
              GraphQL schema.
            </p>
          </Card>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="gradient-background mx-auto mb-6 w-fit animate-fade-in rounded-full p-px">
          <p className="rounded-full bg-paper px-4.5 py-1.5 text-sm">
            Smart integration
          </p>
        </div>
        <SectionHeading
          title="Key advantages of our AI toolkit"
          subtitle="Graphite offers several key advantages by running alongside your Nhost stack"
          className="max-w-xl"
          slotProps={{
            subtitle: {
              className: 'max-w-xl mx-auto',
            },
          }}
        />

        <div className="mx-auto mt-24 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          <div className="group flex flex-row items-start space-x-4 transition-all hover:translate-y-[-4px] hover:transform">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1 transition-all group-hover:scale-110"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">Integrated permissions</h3>
              <p className="text-base text-white text-opacity-65">
                AI features are fully integrated with your project&apos;s
                permissions scheme, ensuring secure access control across your
                application.
              </p>
            </div>
          </div>

          <div className="group flex flex-row items-start space-x-4 transition-all hover:translate-y-[-4px] hover:transform">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1 transition-all group-hover:scale-110"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">Automatic embeddings</h3>
              <p className="text-base text-white text-opacity-65">
                Vector embeddings are generated and kept up to date
                automatically, with no manual intervention required as your data
                changes.
              </p>
            </div>
          </div>

          <div className="group flex flex-row items-start space-x-4 transition-all hover:translate-y-[-4px] hover:transform">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1 transition-all group-hover:scale-110"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">Seamless workflows</h3>
              <p className="text-base text-white text-opacity-65">
                Implement AI-powered workflows with no hassle, leveraging
                GraphQL to access all AI features directly from your frontend
                applications.
              </p>
            </div>
          </div>

          <div className="group flex flex-row items-start space-x-4 transition-all hover:translate-y-[-4px] hover:transform">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1 transition-all group-hover:scale-110"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">Enhanced development</h3>
              <p className="text-base text-white text-opacity-65">
                Accelerate your development process with AI-powered developer
                assistants that understand your specific project structure and
                requirements.
              </p>
            </div>
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="gradient-background mx-auto mb-6 w-fit animate-fade-in rounded-full p-px">
          <p className="rounded-full bg-paper px-4.5 py-1.5 text-sm">
            Simple to implement
          </p>
        </div>
        <SectionHeading
          title="Build AI features in minutes"
          subtitle="Adding AI capabilities to your application has never been easier"
          className="max-w-2xl"
          slotProps={{
            subtitle: {
              className: 'max-w-lg mx-auto',
            },
          }}
        />

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="animate-fade-in rounded-xl border border-divider bg-paper p-6">
            <h3 className="mb-4 text-xl font-bold">
              Enable auto-embeddings with one query
            </h3>
            <p className="mb-6 text-base text-white text-opacity-65">
              Start using semantic search with just a few lines of GraphQL:
            </p>
            <CodeSnippet language="graphql" disableGlow>
              {`mutation {
  graphite {
    enableAutoEmbeddingsForTable(
      tableName: "movies",
      schemaName: "public",
      vectorize: ["title", "overview", "genre"]
    ) {
      id
      status
    }
  }
}`}
            </CodeSnippet>
          </div>

          <div className="animate-fade-in-delay rounded-xl border border-divider bg-paper p-6">
            <h3 className="mb-4 text-xl font-bold">
              Create an AI assistant in seconds
            </h3>
            <p className="mb-6 text-base text-white text-opacity-65">
              Build assistants that can access your application data:
            </p>
            <CodeSnippet language="javascript" disableGlow>
              {`// Create a custom assistant with knowledge of your data
const assistant = await nhost.graphite.createAssistant({
  name: "Movie Expert",
  instructions: "Help users find movies they'll enjoy",
  tools: [
    { type: "knowledge_retrieval" },
    { type: "function", function: { name: "getMovieDetails" } }
  ],
  knowledgeRetrieval: {
    tables: ["public.movies"]
  }
});`}
            </CodeSnippet>
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24">
        <div className="gradient-background mx-auto mb-6 w-fit animate-fade-in rounded-full p-px">
          <p className="rounded-full bg-paper px-4.5 py-1.5 text-sm">
            Complete AI solution
          </p>
        </div>
        <SectionHeading title="Advanced features" className="max-w-lg" />

        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-glow-sm group flex flex-col space-y-3 transition-all">
            <Image
              src="/products/search.svg"
              width={24}
              height={24}
              alt="Search icon"
              className="transition-all group-hover:scale-110"
            />
            <h3 className="text-base font-bold">Semantic Search</h3>
            <p className="text-base text-white text-opacity-65">
              Find information based on meaning, not just keywords, with
              powerful vector-based search capabilities
            </p>
          </Card>

          <Card className="hover:shadow-glow-sm group flex flex-col space-y-3 transition-all">
            <Image
              src="/products/data-federation.svg"
              width={24}
              height={24}
              alt="Data Federation icon"
              className="transition-all group-hover:scale-110"
            />
            <h3 className="text-base font-bold">Document Processing</h3>
            <p className="text-base text-white text-opacity-65">
              Add documents to your AI knowledge base for assistants to
              reference when answering questions
            </p>
          </Card>

          <Card className="hover:shadow-glow-sm group flex flex-col space-y-3 transition-all">
            <Image
              src="/products/bulls-eye.svg"
              width={24}
              height={24}
              alt="Bullseye icon"
              className="transition-all group-hover:scale-110"
            />
            <h3 className="text-base font-bold">Function Calling</h3>
            <p className="text-base text-white text-opacity-65">
              Allow AI assistants to execute functions in your backend code to
              retrieve data or perform actions
            </p>
          </Card>

          <Card className="hover:shadow-glow-sm group flex flex-col space-y-3 transition-all">
            <Image
              src="/products/tool.svg"
              width={24}
              height={24}
              alt="Tool icon"
              className="transition-all group-hover:scale-110"
            />
            <h3 className="text-base font-bold">GraphQL Integration</h3>
            <p className="text-base text-white text-opacity-65">
              Access all AI features through your familiar GraphQL API, keeping
              your tech stack unified
            </p>
          </Card>

          {/* <Card className="hover:shadow-glow-sm group flex flex-col space-y-3 transition-all">
            <Image
              src="/products/typescript.svg"
              width={24}
              height={24}
              alt="TypeScript icon"
              className="transition-all group-hover:scale-110"
            />
            <h3 className="text-base font-bold">
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">
                TypeScript
              </span>{' '}
              SDK
            </h3>
            <p className="text-base text-white text-opacity-65">
              Build AI features with full type safety and autocompletion using
              our TypeScript SDK
            </p>
          </Card> */}

          <Card className="hover:shadow-glow-sm group flex flex-col space-y-3 transition-all">
            <Image
              src="/products/secure.svg"
              width={24}
              height={24}
              alt="Security icon"
              className="transition-all group-hover:scale-110"
            />
            <h3 className="text-base font-bold">Security Controls</h3>
            <p className="text-base text-white text-opacity-65">
              Full control over which data can be accessed by AI features with
              granular permission settings
            </p>
          </Card>
        </div>
      </Container>

      <ProductSection
        slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
        heading={
          <div className="grid grid-flow-row items-center justify-items-center gap-4">
            <div className="gradient-background animate-fade-in rounded-full p-px">
              <p className="rounded-full bg-paper px-4.5 py-1.5">
                Explore the Nhost Ecosystem
              </p>
            </div>

            <SectionHeading title="Complete your backend stack" />
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
