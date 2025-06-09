import { Button } from '@/components/common/Button'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

const heroExample = `import express from 'express'
import { Request, Response } from 'express'

export default (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed')
  }

  try {
    const { amount, currency, customerEmail } = req.body
    // Process payment logic here

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}`

export default function FunctionsHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative grid grid-cols-1 items-center gap-14 pt-16 sm:gap-6 md:grid-cols-2 md:pt-42"
    >
      <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-6 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/functions.svg"
            width={24}
            height={24}
            alt="Lambda function icon"
            priority
          />
        </ProductIcon>

        <SectionHeading
          title={
            <>
              Serverless{' '}
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">
                functions
              </span>
            </>
          }
          subtitle={
            <>
              Deploy server-side code without managing infrastructure.{' '}
              <strong>API endpoints</strong> that scale automatically,{' '}
              <strong>integrate with third-party services</strong>, and run
              globally with <strong>zero maintenance</strong>.
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
            href="https://app.nhost.io/signup"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get started <ArrowRightIcon />
          </Button>
          <Button
            variant="outlined"
            className="text-center text-base"
            href="https://docs.nhost.io/products/functions"
            target="_blank"
            rel="noopener noreferrer"
          >
            View documentation
          </Button>
        </div>
      </div>

      <div className="relative">
        <Glow className="absolute h-full w-full opacity-20 blur-3xl" />
        <CodeSnippet
          language="typescript"
          className="animate-fade-in-delay shadow-lg"
        >
          {heroExample}
        </CodeSnippet>
      </div>
    </Container>
  )
}
