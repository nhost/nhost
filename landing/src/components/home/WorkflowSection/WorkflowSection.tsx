import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import Image from 'next/image'
import { DetailedHTMLProps, HTMLProps, useEffect, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { twMerge } from 'tailwind-merge'

function Dot({ active }: { active: boolean }) {
  return (
    <div className="relative h-2 w-2">
      <div
        className={twMerge(
          'absolute h-full w-full rounded-full',
          active && 'animate-ping bg-brand-main',
        )}
      />

      <div
        className={twMerge(
          'absolute h-full w-full rounded-full bg-white',
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
    <div
      ref={ref}
      className={twMerge('relative min-h-[381px]', className)}
      {...props}
    >
      <CodeSnippet customStyle={{ minHeight: 381 }}>{code}</CodeSnippet>
    </div>
  )
}

function GitWorkflow({
  className,
  ...props
}: DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>) {
  const { ref, inView } = useInView()
  const code = `git add -A
git commit -m "update"
git push`

  return (
    <div
      ref={ref}
      className={twMerge(
        'relative grid min-h-[381px] grid-flow-row content-start gap-6',
        className,
      )}
      {...props}
    >
      <CodeSnippet>{code}</CodeSnippet>
    </div>
  )
}

export default function WorkflowSection() {
  const [activeStep, setActiveStep] = useState(0)

  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'mt-40' } }}
      className="grid grid-flow-row gap-14"
    >
      <div className="mx-auto grid max-w-2xl grid-flow-row gap-4 text-center">
        <h2 className="font-mona text-5xl font-bold">
          Develop locally. Ship globally.
        </h2>

        <p className="text-xl font-normal text-white text-opacity-65">
          Launch something amazing without painful devops.
        </p>
      </div>

      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        <div className="relative lg:col-span-5">
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
              role="button"
              tabIndex={0}
              aria-label="CLI"
              onClick={() => setActiveStep(0)}
              onKeyDown={() => setActiveStep(0)}
              className={twMerge(
                'grid cursor-pointer grid-cols-[72px_1fr] items-start gap-4 motion-safe:transition-all',
                activeStep !== 0 && 'text-white text-opacity-65',
              )}
            >
              <div className="grid grid-flow-col items-center justify-start gap-4">
                <Dot active={activeStep === 0} />

                <span>CLI</span>
              </div>

              <span>
                Run the entire Nhost platform, right from the terminal.
              </span>

              {activeStep === 0 && (
                <CLIWorkflow className="col-span-2 block lg:hidden" />
              )}
            </li>

            <li
              role="button"
              tabIndex={0}
              aria-label="Git"
              onClick={() => setActiveStep(1)}
              onKeyDown={() => setActiveStep(1)}
              className={twMerge(
                'grid cursor-pointer grid-cols-[72px_1fr] items-start gap-4 motion-safe:transition-all',
                activeStep !== 1 && 'text-white text-opacity-65',
              )}
            >
              <div className="grid grid-flow-col items-center justify-start gap-4">
                <Dot active={activeStep === 1} />
                <span>Git</span>
              </div>

              <span>
                Use Git to push and deploy your backend with effortless CI/CD.
              </span>

              {activeStep === 1 && (
                <GitWorkflow className="col-span-2 block lg:hidden" />
              )}
            </li>

            <li
              role="button"
              tabIndex={0}
              aria-label="Cloud"
              onClick={() => setActiveStep(2)}
              onKeyDown={() => setActiveStep(2)}
              className={twMerge(
                'grid cursor-pointer grid-cols-[72px_1fr] items-start gap-4 motion-safe:transition-all',
                activeStep !== 2 && 'text-white text-opacity-65',
              )}
            >
              <div className="grid grid-flow-col items-center justify-start gap-4">
                <Dot active={activeStep === 2} />
                <span>Cloud</span>
              </div>

              <span>
                Your project is deployed on infrastructure configured for
                maximum scalability and security.
              </span>
            </li>
          </ul>
        </div>

        <div className="relative hidden min-h-[381px] lg:col-span-6 lg:col-start-7 lg:block">
          <div className="absolute h-full w-full scale-[225%]">
            <Image
              src="/line-grid.svg"
              width={1177}
              height={930}
              alt="Transparent lines"
            />
          </div>

          {activeStep === 0 && <CLIWorkflow className="z-10" />}
          {activeStep === 1 && <GitWorkflow className="z-10" />}
        </div>
      </div>
    </Container>
  )
}
