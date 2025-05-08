import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { DetailedHTMLProps, HTMLProps, useEffect, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useInView } from 'react-intersection-observer'
import { twMerge } from 'tailwind-merge'

const Globe = dynamic(() => import('@/components/common/Globe/Globe'), {
  loading: () => <div className="h-80 w-full" />,
})

function Dot({ active }: { active: boolean }) {
  return (
    <div className="relative h-2 w-2">
      <div
        className={twMerge(
          'absolute h-full w-full animate-ping rounded-full bg-brand-main motion-safe:transition-all lg:animate-none lg:bg-transparent',
          active && 'animate-ping bg-brand-main',
        )}
      />

      <div
        className={twMerge(
          'absolute h-full w-full rounded-full bg-white motion-safe:transition-all',
          !active && 'lg:bg-opacity-65',
        )}
      />
    </div>
  )
}

function CLIWorkflow({
  className,
  ...props
}: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>) {
  const { ref, inView } = useInView({ threshold: 0.3 })
  const codeString = `$ nhost up

- Postgres:         postgres://postgres:postgres@localhost:5432/postgres
- GraphQL:          http://localhost:1337/v1/graphql
- Auth:             http://localhost:1337/v1/auth
- Storage:          http://localhost:1337/v1/storage
- Functions:        http://localhost:1337/v1/functions

- Hasura console:  http://localhost:9695

- Mailhog:         http://localhost:8025

- subdomain:       localhost
- region:          (empty)`

  const [code, setCode] = useState(`$ `)

  useEffect(() => {
    if (!inView || code === codeString) {
      return
    }

    const finalCommand = '$ nhost up'

    if (code === finalCommand) {
      setTimeout(() => setCode(codeString), 750)

      return
    }

    const interval = setInterval(
      () => {
        const currentDiff = finalCommand.replace(code, '')
        setCode((prev) => `${prev}${currentDiff[0]}`)
      },
      code === '$ ' ? 1500 : 100,
    )

    return () => clearInterval(interval)
  }, [code, codeString, inView])

  return (
    <div ref={ref} className={twMerge(className, 'relative pb-2')} {...props}>
      <div className="hidden w-full sm:block sm:min-h-[381px]">
        <CodeSnippet
          customStyle={{ minHeight: 381 }}
          slotProps={{
            root: {
              className: twMerge(
                'mx-auto lg:max-w-xl',
                code !== codeString && 'cursor',
              ),
            },
          }}
        >
          {code}
        </CodeSnippet>
      </div>

      <div className="min-h-[570px] w-full sm:hidden">
        <CodeSnippet
          customStyle={{ minHeight: 570 }}
          slotProps={{
            root: {
              className: twMerge(code !== codeString && 'cursor'),
            },
          }}
        >
          {code}
        </CodeSnippet>
      </div>
    </div>
  )
}

function GitWorkflow({
  className,
  ...props
}: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>) {
  const { ref } = useInView()
  const code = `git add .
git commit -m "add permissions"
git push origin`

  return (
    <div
      ref={ref}
      className={twMerge(
        'relative grid grid-flow-row content-start gap-6 sm:min-h-[381px]',
        className,
      )}
      {...props}
    >
      <CodeSnippet disableLineGrid>{code}</CodeSnippet>

      <div
        className={twMerge(
          'relative',
          'after:absolute after:left-0 after:right-0 after:bottom-0 after:top-0',
          'after:z-0 after:h-full after:w-full after:rounded-full',
          'after:backface-hidden after:skew-x-6 after:skew-y-3 after:transform-gpu after:bg-brand-main after:bg-opacity-20 after:blur-[32px]',
        )}
      >
        <Image
          src="/images/deployments.png"
          alt="A list of deployments in the Nhost Dashboard"
          width={846}
          height={242}
          quality={100}
          className="relative z-10"
        />
      </div>
    </div>
  )
}

function CloudWorkflow({
  className,
  ...props
}: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>) {
  return (
    <div className={twMerge('lg:-mt-16', className)} {...props}>
      <div className="relative z-0 h-60 w-full md:h-80">
        <ErrorBoundary
          FallbackComponent={() => (
            <div className="w-full">
              <Image
                src="/common/globe.png"
                width={513}
                height={309}
                alt="Static globe"
                className="mx-auto h-80 object-contain"
              />
            </div>
          )}
        >
          <Globe />
        </ErrorBoundary>

        <div className="bg-black-to-transparent absolute top-0 left-0 right-0 z-20 h-full w-full" />
        <div className="border-gradient relative z-30 mx-auto h-px w-10/12" />
        <div className="bg-black-to-transparent absolute -bottom-[300px] z-20 h-[664px] w-full" />
        <Glow className="absolute -bottom-16 left-0 right-0 h-16 w-2/3 blur-3xl" />
      </div>

      <div className="relative z-10 mt-6 grid grid-cols-1 place-items-center gap-6 lg:grid-cols-3 lg:gap-0">
        <div className="grid grid-flow-row gap-2 text-center">
          <p className="font-mona text-3.5xl font-bold lg:text-5xl">6</p>
          <p className="text-base">Regions</p>
        </div>
        <div className="grid grid-flow-row gap-2 text-center">
          <p className="font-mona text-3.5xl font-bold lg:text-5xl">80+</p>
          <p className="text-base">CDN Locations</p>
        </div>
        <div className="grid grid-flow-row gap-2 text-center">
          <p className="font-mona text-3.5xl font-bold lg:text-5xl">4</p>
          <p className="text-base">Continents</p>
        </div>
      </div>
    </div>
  )
}

export default function WorkflowSection() {
  const [activeStep, setActiveStep] = useState(0)

  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'mt-24 lg:mt-28' } }}
      className="grid grid-flow-row gap-12 pb-12 lg:gap-28"
    >
      <SectionHeading
        title="Develop Locally. Ship Globally."
        subtitle="From local development to global deployment in minutes. No DevOps expertise required."
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="relative z-20 lg:col-span-5">
          <div className="absolute left-[3px] top-1/2 hidden -translate-y-1/2 lg:block">
            <Image
              src="/common/dashed-line.svg"
              width={1}
              height={386}
              alt="A dashed line"
              loading="eager"
            />
          </div>

          <ul className="grid grid-flow-row gap-20 text-base lg:gap-16">
            <li
              className={twMerge(
                'grid cursor-default grid-cols-[1fr] gap-10 motion-safe:transition-all lg:gap-4',
                activeStep !== 0 && 'text-white lg:text-opacity-65',
              )}
            >
              <div
                className="col-span-2 grid cursor-pointer grid-cols-[72px_1fr] items-start gap-4"
                role="button"
                tabIndex={0}
                aria-label="CLI"
                onClick={() => setActiveStep(0)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return
                  }

                  event.preventDefault()

                  setActiveStep(0)
                }}
              >
                <div className="relative grid grid-flow-col items-center justify-start gap-4">
                  <Dot active={activeStep === 0} />

                  <Image
                    src="/common/dashed-line-gradient.svg"
                    width={1}
                    height={86}
                    alt="A dashed line with a gradient background"
                    className="absolute left-1 top-0 lg:hidden"
                    loading="eager"
                  />

                  <span>CLI</span>
                </div>

                <span>
                  Run the entire Nhost stack locally with a single command. Instant setup with all services connected and ready to use.
                </span>
              </div>

              <CLIWorkflow className="col-span-2 block max-w-full lg:hidden" />
            </li>

            <li
              className={twMerge(
                'grid grid-cols-[1fr] gap-10 motion-safe:transition-all lg:gap-4',
                activeStep !== 1 && 'text-white lg:text-opacity-65',
              )}
            >
              <div
                className="grid cursor-pointer grid-cols-[72px_1fr] items-start gap-4"
                role="button"
                tabIndex={0}
                aria-label="Git"
                onClick={() => setActiveStep(1)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return
                  }

                  event.preventDefault()

                  setActiveStep(1)
                }}
              >
                <div className="relative grid grid-flow-col items-center justify-start gap-4">
                  <Image
                    src="/common/dashed-line-gradient.svg"
                    width={1}
                    height={86}
                    alt="A dashed line with a gradient background"
                    className="absolute left-1 top-0 -translate-y-full lg:hidden"
                    loading="eager"
                  />

                  <Dot active={activeStep === 1} />

                  <Image
                    src="/common/dashed-line-gradient.svg"
                    width={1}
                    height={86}
                    alt="A dashed line with a gradient background"
                    className="absolute left-1 top-0 lg:hidden"
                    loading="eager"
                  />

                  <span>Git</span>
                </div>

                <span>
                  Simple Git-based deployments with built-in CI/CD. Push your code and Nhost automatically builds, tests, and deploys your backend.
                </span>
              </div>

              <div className="relative block lg:hidden">
                <LineGrid className="scale-110" />
                <GitWorkflow />
              </div>
            </li>

            <li
              className={twMerge(
                'grid items-start gap-10 motion-safe:transition-all lg:gap-4',
                activeStep !== 2 && 'text-white lg:text-opacity-65',
              )}
            >
              <div
                className="grid cursor-pointer grid-cols-[72px_1fr] items-start gap-4"
                role="button"
                tabIndex={0}
                aria-label="Cloud"
                onClick={() => setActiveStep(2)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return
                  }

                  event.preventDefault()

                  setActiveStep(2)
                }}
              >
                <div className="relative grid grid-flow-col items-center justify-start gap-4">
                  <Image
                    src="/common/dashed-line-gradient.svg"
                    width={1}
                    height={86}
                    alt="A dashed line with a gradient background"
                    className="absolute left-1 top-0 -translate-y-full lg:hidden"
                    loading="eager"
                  />

                  <Dot active={activeStep === 2} />

                  <span>Cloud</span>
                </div>

                <span>
                  Production-ready infrastructure in 6 regions across 4 continents. Enterprise-grade security, autoscaling, and 80+ CDN locations for maximum performance.
                </span>
              </div>

              <div className="relative z-0 overflow-hidden lg:hidden">
                <LineGrid />
                <CloudWorkflow className="grid lg:hidden" />
              </div>
            </li>
          </ul>
        </div>

        <div className="relative hidden min-h-[381px] lg:col-span-6 lg:col-start-7 lg:block">
          {activeStep !== 0 && <LineGrid className="scale-110" />}

          <div className="relative z-10">
            {activeStep === 0 && <CLIWorkflow className="z-10" />}
            {activeStep === 1 && <GitWorkflow className="z-10" />}
            {activeStep === 2 && <CloudWorkflow />}
          </div>
        </div>
      </div>
    </Container>
  )
}
