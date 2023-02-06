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
  sendEmail: `// todo: create example`,
  query: `// todo: create example`,
  stripe: `// todo: create example`,
  helloWorld: `// todo: create example`,
}

const heroExample = `export default (req: Request, res: Response) => {
  res.status(200).send('Hello world')
}`

export default function FunctionsPage() {
  const [selectedExample, setSelectedExample] =
    useState<keyof typeof codeSnippets>('sendEmail')

  return (
    <>
      <Container
        component="section"
        className="relative grid grid-cols-1 items-center gap-14 py-8 sm:gap-6 md:grid-cols-2 md:py-40"
      >
        <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-4 lg:px-28">
          <ProductIcon>
            <Image
              src="/products/functions.svg"
              width={24}
              height={24}
              alt="A user"
              priority
            />
          </ProductIcon>

          <SectionHeading
            title="Functions"
            subtitle="Server-side code that works as API endpoints with global scale."
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
            href="https://app.nhost.io/sendEmail"
            rel="noopener noreferrer"
            target="_blank"
          >
            Start building <ArrowRightIcon />
          </Button>
        </div>

        <div>
          <CodeSnippet language="typescript">{heroExample}</CodeSnippet>
        </div>
      </Container>

      <Container component="section" className="grid grid-flow-row gap-24">
        <div className="grid grid-flow-row justify-items-center gap-8">
          <SectionHeading
            title="Functions that scale automatically"
            subtitle="DigitalOcean Functions is a serverless computing solution that runs on-demand, enabling you to focus on your code, scale instantly with confidence, and save costs by eliminating the need to maintain servers."
            className="max-w-2xl"
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
            href="https://docs.nhost.io/serverless-functions"
            rel="noopener noreferrer"
            target="_blank"
          >
            Explore the docs <ArrowRightIcon />
          </Button>
        </div>

        <div className="grid grid-cols-1 items-center justify-items-center gap-0 pb-12 xl:grid-cols-2 xl:justify-items-start xl:gap-6">
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
            <div className="relative z-10 grid grid-flow-col justify-evenly xl:justify-center">
              <ExampleSelectorButton
                active={selectedExample === 'sendEmail'}
                onClick={() => setSelectedExample('sendEmail')}
              >
                Send Email
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'query'}
                onClick={() => setSelectedExample('query')}
              >
                Query GraphQL
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'stripe'}
                onClick={() => setSelectedExample('stripe')}
              >
                Receive Stripe Webhooks
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'helloWorld'}
                onClick={() => setSelectedExample('helloWorld')}
              >
                Hello World
              </ExampleSelectorButton>
            </div>

            <Image
              src="/common/connectors/functions-example-connectors.svg"
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

      <Container component="section" className="mt-24">
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

            <Button href="https://app.nhost.io/sendEmail" className="mt-6">
              Start building <ArrowRightIcon />
            </Button>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8">
            <Image
              src="/products/user-check.svg"
              width={24}
              height={24}
              alt="User with a checkmark"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">CDN</h3>

              <p className="text-base text-white text-opacity-65">
                Improve security by letting enabling Multi-Factor
                Authentication.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-7">
            <Image
              src="/products/resize.svg"
              width={24}
              height={24}
              alt="Resize icon"
              className="mx-auto"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Image Transformation</h3>

              <p className="text-base text-white text-opacity-65">
                Improve security by letting enabling Multi-Factor
                Authentication.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8">
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
                Improve security by letting enabling Multi-Factor
                Authentication.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/box.svg"
              width={24}
              height={24}
              alt="A box"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Buckets</h3>

              <p className="text-base text-white text-opacity-65">
                Improve security by letting enabling Multi-Factor
                Authentication.
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
        disabledLink="storage"
      />

      <CTASection />
    </>
  )
}

FunctionsPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
