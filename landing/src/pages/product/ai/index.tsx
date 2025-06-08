import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { ExampleSelectorButton } from '@/components/common/ExampleSelectorButton'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
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
            title="Enhance your backend with AI tools"
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
          subtitle="The AI toolkit extends the Nhost stack providing AI super-powers to your application."
          className="max-w-xl"
          slotProps={{
            subtitle: {
              className: 'max-w-xl mx-auto',
            },
          }}
        />

        <div className="mx-auto mt-24 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="hover:shadow-glow-sm flex flex-col space-y-3 transition-all">
            <Image
              src="/products/ai-assistants.svg"
              width={24}
              height={24}
              alt="AI Assistants icon"
              className="transition-all group-hover:scale-110"
            />
            <h3 className="text-base font-bold">AI agents</h3>
            <p className="text-base text-white text-opacity-65">
              Create customized AI agents so your users can interact with
              your data using natural language and get intelligent responses.
            </p>
          </Card>
          <Card className="hover:shadow-glow-sm flex flex-col space-y-3 transition-all">
            <Image
              src="/products/auto-embeddings.svg"
              width={24}
              height={24}
              alt="Auto-Embeddings icon"
              className="transition-all group-hover:scale-110"
            />
            <h3 className="text-base font-bold">Automatic embeddings</h3>
            <p className="text-base text-white text-opacity-65">
              Generate embeddings for your data automatically as it is inserted
              or modified, enabling powerful semantic search capabilities.
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
            <h3 className="text-base font-bold">Developer assistant</h3>
            <p className="text-base text-white text-opacity-65">
              Boost your development speed with a custom AI assistant that has
              access to your project&apos;s database and
              GraphQL schema.
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
            <h3 className="text-base font-bold">Talk with your files</h3>
            <p className="text-base text-white text-opacity-65">
              Upload files to Nhost Storage and let your AI agents interact with
              them.
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
          subtitle="Key advantages by running alongside your Nhost stack"
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
            File stores
          </p>
        </div>
        <SectionHeading
          title="Agents that talk to your data"
          subtitle="Files automatically uploaded to Nhost Storage are embedded and available to your agents"
          className="max-w-2xl"
          slotProps={{
            subtitle: {
              className: 'max-w-lg mx-auto',
            },
          }}
        />

        <div className="mx-auto mt-16 flex max-w-5xl justify-center">
          <iframe
            width="560"
            height="315"
            src="https://www.youtube.com/embed/J4dUO6YwOsk?si=WCPJHaVzRfYfdjrW"
            title="Assistants & File Stores"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
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
            <h3 className="text-base font-bold">Semantic search</h3>
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
            <h3 className="text-base font-bold">Document processing</h3>
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
            <h3 className="text-base font-bold">Function calling</h3>
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
            <h3 className="text-base font-bold">GraphQL integration</h3>
            <p className="text-base text-white text-opacity-65">
              Access all AI features through your familiar GraphQL API, keeping
              your tech stack unified
            </p>
          </Card>

          <Card className="hover:shadow-glow-sm group flex flex-col space-y-3 transition-all">
            <Image
              src="/products/secure.svg"
              width={24}
              height={24}
              alt="Security icon"
              className="transition-all group-hover:scale-110"
            />
            <h3 className="text-base font-bold">Security controls</h3>
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
                Your backend platform
              </p>
            </div>

            <SectionHeading
              title="Explore the Nhost ecosystem"
              subtitle="AI tools is just one part of your backend stack. Discover how all our services work together to power your applications."
            />
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
