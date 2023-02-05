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
import { ReactElement, useState } from 'react'

const codeSnippets = {
  insertData: `const todos = await nhost.graphql.mutation.insertTodo({
  variables: {
    object: {
      title: 'My first todo',
    }
  },
  select: {
    id: true,
  }
})`,
  readData: `const todos = await nhost.graphql.query.todos()

// or select individual fields

const todos = await nhost.graphql.query.todos({
  select: {
    id: true,
    title: true,
  }
})`,
  updateData: `const todos = await nhost.graphql.mutation.updateTodo({
  variables: {
    id: todo.id,
    set: {
      done: true,
    },
  }
})`,
  deleteData: `const todos = await nhost.graphql.mutation.deleteTodo({
  variables: {
    id: todo.id,
  }
})`,
}

type GraphqlExamples = typeof codeSnippets

export default function GraphqlPage() {
  const [selectedExample, setSelectedExample] =
    useState<keyof GraphqlExamples>('insertData')

  return (
    <>
      <Container
        component="section"
        className="relative grid grid-cols-1 gap-14 py-8 sm:gap-6 md:grid-cols-2 md:py-52"
      >
        <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-4 lg:px-28">
          <ProductIcon>
            <Image
              src="/products/graphql.svg"
              width={24}
              height={24}
              alt="Logo of GraphQL"
              priority
            />
          </ProductIcon>

          <SectionHeading
            title="GraphQL API"
            subtitle="Instant and scalable GraphQL API with realtime subscriptions and powerful permissions built in."
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
            Learn more about GraphQL API <ArrowRightIcon />
          </Button>
        </div>

        <Image
          src="/common/graphql-hero.svg"
          width={608}
          height={608}
          alt="GraphQL logo"
          className="z-0 mx-auto md:absolute md:-right-11 md:top-1/2 md:-translate-y-1/2 md:object-none lg:right-11"
          priority
        />
      </Container>

      <Container component="section" className="grid grid-flow-row gap-24">
        <div className="grid grid-flow-row justify-items-center gap-8">
          <SectionHeading
            title="Type-safe GraphQL API"
            subtitle="Nhost GraphQL Client is tailored to your GraphQL API. The auto-completion helps you figure out your query without the need for documentation."
          />

          <Button
            variant="borderless"
            className="text-base font-bold"
            size="sm"
          >
            Explore the docs <ArrowRightIcon />
          </Button>
        </div>

        <div className="grid grid-cols-1 items-center justify-items-center gap-0 xl:grid-cols-2 xl:justify-items-start xl:gap-6">
          <div className="order-2 w-full xl:order-1">
            <CodeSnippet
              language="typescript"
              className="min-h-[330px]"
              slotProps={{ root: { className: 'mx-auto md:max-w-xl' } }}
            >
              {codeSnippets[selectedExample]}
            </CodeSnippet>
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

      <Container component="section" className="mt-24 lg:mt-40">
        <SectionHeading
          title="Powerful and simple permissions"
          subtitle="Row and column level permissions to safely expose your GraphQL API to the world"
          className="max-w-lg"
        />

        <div className="mx-auto mt-16 flex h-52 w-full max-w-5xl items-center justify-center rounded-xl border border-divider bg-paper">
          Video Placeholder
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <SectionHeading title="And more..." className="max-w-lg" />

        <div className="mx-auto mt-16 grid max-w-xs grid-cols-1 content-start justify-start gap-6 sm:max-w-2xl sm:auto-rows-fr sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
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
              src="/products/database.svg"
              width={24}
              height={24}
              alt="A database"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Query with ease</h3>

              <p className="text-base text-white text-opacity-65">
                Filter, sort, order by group, aggregate, limit. All operations
                are supported out of the box.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-7">
            <Image
              src="/products/search.svg"
              width={24}
              height={24}
              alt="Magnifying glass"
              className="mx-auto"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Search</h3>

              <p className="text-base text-white text-opacity-65">
                Hac habitasse platea dictumst quisque sagittis purus sit amet
                volutpat consequiat mauris.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8">
            <Image
              src="/products/hasura.svg"
              width={24}
              height={24}
              alt="Logo of Hasura"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Hasura GrapQL Engine</h3>

              <p className="text-base text-white text-opacity-65">
                The GraphQL API is powered by the Hasura GraphQL Engine which
                has support for even triggers, actions, and more.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/checkmark.svg"
              width={24}
              height={24}
              alt="A checkmark in a circle"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">N+1 problem, solved</h3>

              <p className="text-base text-white text-opacity-65">
                Hac habitasse platea dictumst quisque sagittis purus sit amet
                volutpat consequiat mauris.
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
        disabledLink="graphql"
      />

      <CTASection />
    </>
  )
}

GraphqlPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
