import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { DetailedHTMLProps, HTMLProps, useEffect, useState } from 'react'
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
          'absolute h-full w-full rounded-full motion-safe:transition-all',
          active && 'animate-ping bg-brand-main',
        )}
      />

      <div
        className={twMerge(
          'absolute h-full w-full rounded-full bg-white motion-safe:transition-all',
          !active && 'bg-opacity-65',
        )}
      />
    </div>
  )
}

function CLIWorkflow({
  className,
  ...props
}: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>) {
  const { ref, inView } = useInView()
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

  const [code, setCode] = useState(`$`)

  useEffect(() => {
    if (!inView || code === codeString) {
      return
    }

    const finalCommand = '$ nhost up'

    if (code === finalCommand) {
      setTimeout(() => setCode(codeString), 750)

      return
    }

    const interval = setInterval(() => {
      const currentDiff = finalCommand.replace(code, '')
      setCode((prev) => `${prev}${currentDiff[0]}`)
    }, 50)

    return () => clearInterval(interval)
  }, [code, codeString, inView])

  return (
    <div ref={ref} className={twMerge(className, 'relative')} {...props}>
      <div className="hidden w-full sm:block sm:min-h-[381px]">
        <CodeSnippet customStyle={{ minHeight: 381 }}>{code}</CodeSnippet>
      </div>

      <div className="min-h-[570px] w-full sm:hidden">
        <CodeSnippet customStyle={{ minHeight: 570 }}>{code}</CodeSnippet>
      </div>
    </div>
  )
}

function GitWorkflow({
  className,
  ...props
}: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>) {
  const { ref, inView } = useInView()
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
      <CodeSnippet>{code}</CodeSnippet>

      <div
        className={twMerge(
          'relative',
          'after:absolute after:left-0 after:right-0 after:bottom-0 after:top-0',
          'after:z-0 after:h-full after:w-full after:rounded-full',
          'after:skew-x-6 after:skew-y-3 after:bg-brand-main after:bg-opacity-20 after:blur-[32px]',
        )}
      >
        <Image
          src="/deployments.png"
          alt="A list of deployments in the Nhost Dashboard"
          width={846}
          height={242}
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
    <div
      className={twMerge(
        'grid grid-flow-row justify-center gap-6 lg:-mt-16',
        className,
      )}
      {...props}
    >
      <div className="relative z-0 h-60 md:h-80">
        <Globe />
        <div className="bg-black-to-transparent absolute top-0 left-0 right-0 z-20 h-full w-full" />
        <div className="border-gradient relative z-30 mx-auto h-px w-10/12" />
        <div className="bg-black-to-transparent absolute -bottom-[300px] z-20 h-[664px] w-full" />
        <div className="absolute -bottom-16 left-0 right-0 mx-auto h-16 w-2/3 rounded-full bg-brand-main blur-[98px]" />
      </div>

      <div className="relative z-10 grid grid-cols-1 place-items-center gap-6 lg:grid-cols-3 lg:gap-0">
        <div className="grid grid-flow-row gap-2 text-center">
          <p className="font-mona text-5xl font-bold">6</p>
          <p className="text-base">Regions</p>
        </div>
        <div className="grid grid-flow-row gap-2 text-center">
          <p className="font-mona text-5xl font-bold">99.99%</p>
          <p className="text-base">Guaranteed Uptime</p>
        </div>
        <div className="grid grid-flow-row gap-2 text-center">
          <p className="font-mona text-5xl font-bold">185</p>
          <p className="text-base">Edge Locations</p>
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
      slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
      className="grid grid-flow-row gap-14 overflow-hidden"
    >
      <div className="mx-auto grid max-w-2xl grid-flow-row gap-4 text-center">
        <h2 className="font-mona text-5xl font-bold">
          Develop locally. Ship globally.
        </h2>

        <p className="text-xl font-normal text-white text-opacity-65">
          Launch something amazing without painful devops.
        </p>
      </div>

      <div className="grid grid-cols-1 items-center gap-8 py-14 lg:grid-cols-12 lg:py-40">
        <div className="relative z-20 lg:col-span-5">
          <div className="absolute left-[3px] top-1/2 hidden -translate-y-1/2 lg:block">
            <Image
              src="/dashed-line.svg"
              width={1}
              height={386}
              alt="A dashed line"
            />
          </div>

          <ul className="grid grid-flow-row gap-16 text-base">
            <li
              className={twMerge(
                'grid cursor-default grid-cols-[1fr] gap-4 motion-safe:transition-all',
                activeStep !== 0 && 'text-white text-opacity-65',
              )}
            >
              <div
                className="col-span-2 grid cursor-pointer grid-cols-[72px_1fr] items-start gap-4"
                role="button"
                tabIndex={0}
                aria-label="CLI"
                onClick={() => setActiveStep(0)}
                onKeyDown={() => setActiveStep(0)}
              >
                <div className="grid grid-flow-col items-center justify-start gap-4">
                  <Dot active={activeStep === 0} />

                  <span>CLI</span>
                </div>

                <span>
                  Run the entire Nhost platform, right from the terminal.
                </span>
              </div>

              {activeStep === 0 && (
                <CLIWorkflow className="col-span-2 block max-w-full lg:hidden" />
              )}
            </li>

            <li
              className={twMerge(
                'grid gap-4 motion-safe:transition-all',
                activeStep !== 1 && 'text-white text-opacity-65',
              )}
            >
              <div
                className="grid cursor-pointer grid-cols-[72px_1fr] items-start gap-4"
                role="button"
                tabIndex={0}
                aria-label="Git"
                onClick={() => setActiveStep(1)}
                onKeyDown={() => setActiveStep(1)}
              >
                <div className="grid grid-flow-col items-center justify-start gap-4">
                  <Dot active={activeStep === 1} />
                  <span>Git</span>
                </div>

                <span>
                  Use Git to push and deploy your backend with effortless CI/CD.
                </span>
              </div>

              {activeStep === 1 && <GitWorkflow className="grid lg:hidden" />}
            </li>

            <li
              className={twMerge(
                'grid grid-flow-row items-start gap-4 motion-safe:transition-all',
                activeStep !== 2 && 'text-white text-opacity-65',
              )}
            >
              <div
                className="grid cursor-pointer grid-cols-[72px_1fr] items-start gap-4"
                role="button"
                tabIndex={0}
                aria-label="Cloud"
                onClick={() => setActiveStep(2)}
                onKeyDown={() => setActiveStep(2)}
              >
                <div className="grid grid-flow-col items-center justify-start gap-4">
                  <Dot active={activeStep === 2} />
                  <span>Cloud</span>
                </div>

                <span>
                  Your project is deployed on infrastructure configured for
                  maximum scalability and security.
                </span>
              </div>

              {activeStep === 2 && (
                <div className="relative z-0 overflow-hidden lg:hidden">
                  <div className="absolute z-0 h-full w-full -translate-x-1/4 scale-[200%]">
                    <Image
                      src="/line-grid.svg"
                      width={1177}
                      height={930}
                      alt="Transparent lines"
                    />
                  </div>

                  <CloudWorkflow className="grid lg:hidden" />
                </div>
              )}
            </li>
          </ul>
        </div>

        <div className="relative hidden min-h-[381px] lg:col-span-6 lg:col-start-7 lg:block">
          <div className="absolute z-0 h-full w-full -translate-x-1/4 scale-[200%]">
            <Image
              src="/line-grid.svg"
              width={1177}
              height={930}
              alt="Transparent lines"
            />
          </div>

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
