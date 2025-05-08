import { Button } from '@/components/common/Button'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

const graphiteQuery = `# Query for semantic search using embeddings
query {
  graphiteSearchMovies(
    args: {
      query: "comedy in space",
      amount: 5
    }
  ) {
    name
    overview
    genre
    score
  }
}`

const assistantCode = `// Creating an assistant to help users
const { assistant } = await nhost.graphite.createAssistant({
  name: "Product Expert",
  instructions: "You are a helpful assistant that answers questions about our products.",
  tools: [{ type: "knowledge_retrieval" }],
  fileIds: ["file-abc123"] // Product documentation
});

// Ask a question to the assistant
const thread = await nhost.graphite.createThread();
await nhost.graphite.createMessage({
  threadId: thread.id,
  role: "user",
  content: "What's the best plan for my startup?"
});`

export default function AIHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative grid items-start grid-cols-1 gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="relative z-10 grid content-center justify-start grid-flow-row gap-6 pt-16 justify-items-start md:pt-42 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/graphite-logo.svg"
            width={20}
            height={20}
            alt="Graphite icon"
            priority
          />
        </ProductIcon>

        <SectionHeading
          title={
            <>
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">AI</span> Toolkit
            </>
          }
          subtitle={
            <>
              Add AI capabilities to your applications in minutes. <strong>Vector search</strong>, <strong>embeddings generation</strong>, <strong>AI assistants</strong>, and more - integrate advanced AI features with just a few lines of code.
            </>
          }
          className="text-left"
          slotProps={{
            title: {
              component: 'h1',
              className: 'font-semibold text-3.5xl md:text-4.5xl',
            },
            subtitle: {
              className: 'text-base !leading-normal',
            },
          }}
        />
        
        <div className="flex gap-4 pt-2">
          <Button
            className="text-center text-base"
            href="https://app.nhost.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get Started <ArrowRightIcon />
          </Button>
          <Button
            variant="outlined"
            className="text-center text-base"
            href="https://docs.nhost.io/graphite"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Documentation
          </Button>
        </div>
      </div>

      <div className="relative sm:pt-6 md:-translate-x-1 md:pt-24">
        <LineGrid className="md:-translate-x-11 md:-translate-y-11" priority />

        <Glow className="h-[75%] w-full opacity-40 blur-3xl animate-pulse" />

        <Image
          src="/products/graphite-hero.png"
          alt="Auto-Embeddings page in the Nhost Dashboard"
          width={2880}
          height={1800}
          className="relative z-10 w-full h-auto animate-slide-middle-up"
          priority
          sizes="(max-width: 1024px) 50vw, 60vw"
        />

        <div className="absolute z-20 -right-3 -bottom-6 xl:-right-5 xl:-bottom-24 flex flex-col gap-4">
          <CodeSnippet
            language="graphql"
            disableGlow
            disableLineGrid
            className="max-w-sm shadow-lg animate-fade-in-delay"
          >
            {graphiteQuery}
          </CodeSnippet>
          
          <CodeSnippet
            language="javascript"
            disableGlow
            disableLineGrid
            className="max-w-sm shadow-lg hidden xl:block animate-fade-in-delay-2"
          >
            {assistantCode}
          </CodeSnippet>
        </div>
      </div>
    </Container>
  )
}
