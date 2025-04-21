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
import { FunctionsHeroSection } from '@/components/functions/FunctionsHeroSection'
import { ProductSection } from '@/components/product/ProductSection'
import Image from 'next/image'
import { ReactElement, useState } from 'react'

const codeSnippets = {
  sendEmail: `import nodemailer from 'nodemailer'

export default async (req, res) => {
  let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    }
  })

  let info = await transporter.sendMail({
    from: '"Fred Foo 👻" <foo@example.com>',
    to: 'bar@example.com, baz@example.com',
    subject: 'Hello ✔',
    text: 'Hello world?',
    html: '<b>Hello world?</b>'
  })

  res.json('Message sent')
}`,
  query: `export default async (req, res) => {

  const CUSTOMERS = gql\`
    query {
      customers {
        id
        name
      }
    }
  \`

  const { data } = await nhost.graphql.request(CUSTOMERS)

  res.status(200).send({data});
}`,
  stripe: `import { Request, Response } from 'express'

import Stripe from 'stripe'

type NhostResponse = Response
type NhostRequest = Request & {
  rawBody: string
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-08-01'
})

export default async function handler(req: NhostRequest, res: NhostResponse) {
  const sig = req.headers['stripe-signature'] as string
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event

  // Match the raw body to content type application/json
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret)
  } catch (err: any) {
    console.log(err)
    return res.status(400).send('Webhook Error');
  }

  if (!event) {
    console.log('no event found')
    return res.status(400).send('No event')
  }

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created': {
      const { object } = event.data as any
      console.log('customer subscription created!')
      console.log(object)
      break
    }
    // ... handle other event types
    default:
      console.log('Unhandled event type', event.type)
  }

  res.json({ received: true })
}`,
  helloWorld: `export default (req, res) => {
  res.status(200).send('Hello World')
}`,
}

export default function FunctionsPage() {
  const [selectedExample, setSelectedExample] =
    useState<keyof typeof codeSnippets>('sendEmail')

  return (
    <>
      <FunctionsHeroSection />

      <Container
        component="section"
        className="mt-16 grid grid-flow-row gap-16 md:mt-32 md:gap-24"
        slotProps={{
          root: { className: 'overflow-hidden xl:overflow-visible' },
        }}
      >
        <div className="grid grid-flow-row justify-items-center gap-8">
          <SectionHeading
            title="Serverless Functions at Scale"
            subtitle="Handle custom logic, specific business requirements, and custom integrations using Nhost Functions."
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
            href="https://docs.nhost.io/products/functions/overview"
            rel="noopener noreferrer"
            target="_blank"
          >
            Explore the docs <ArrowRightIcon />
          </Button>
        </div>

        <div className="grid grid-cols-1 items-start justify-items-center gap-0 pb-12 xl:grid-cols-2 xl:justify-items-start xl:gap-6">
          <div className="order-2 w-full xl:order-1">
            <CodeSnippet
              language="typescript"
              customStyle={{ minHeight: 330 }}
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
              className="absolute -top-32 left-0 right-0 z-0 mx-auto hidden h-auto w-full object-none xl:block"
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
              src="/products/code.svg"
              width={24}
              height={24}
              alt="Code"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Environment Variables</h3>

              <p className="text-base text-white text-opacity-65">
                Full access to system and manually defined environment
                variables.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-7">
            <Image
              src="/products/typescript.svg"
              width={24}
              height={24}
              alt="TypScript"
              className="mx-auto"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">TypeScript-Ready</h3>

              <p className="text-base text-white text-opacity-65">
                Deploy your TypeScript functions with ease.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8">
            <Image
              src="/products/backups.svg"
              width={24}
              height={24}
              alt="A paper"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Event Triggers</h3>

              <p className="text-base text-white text-opacity-65">
                Use Functions to consume event triggers.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/tool.svg"
              width={24}
              height={24}
              alt="Tool"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Zero Maintenance</h3>

              <p className="text-base text-white text-opacity-65">
                Functions are automatically scaled and maintained.
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
        disabledLink="functions"
      />

      <CTASection />
    </>
  )
}

FunctionsPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
