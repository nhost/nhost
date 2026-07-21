import { Button } from '@/components/common/Button'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { ArrowLeftIcon } from '@/components/common/icons/ArrowLeftIcon'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

const dockerfileExample = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000
CMD ["node", "index.js"]`

export default function RunHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative grid grid-cols-1 items-start gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-6 pt-16 md:pt-42 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/play.svg"
            width={30}
            height={30}
            alt="Play icon"
            priority
          />
        </ProductIcon>

        <SectionHeading
          title={
            <>
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">
                Run
              </span>{' '}
              custom services
            </>
          }
          subtitle={
            <>
              Deploy any docker container alongside your Nhost stack.{' '}
              <strong>Build</strong>, <strong>push</strong>, and{' '}
              <strong>run</strong> custom services in any language with
              full control over your infrastructure.
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
            href="https://docs.nhost.io/products/run"
            target="_blank"
            rel="noopener noreferrer"
          >
            View documentation
          </Button>
        </div>
      </div>

      <div className="relative sm:pt-6 md:pt-24">
        <LineGrid className="md:-translate-x-11 md:-translate-y-11" priority />

        <Glow className="mx-auto h-[75%] w-[90%] animate-pulse opacity-40 blur-3xl" />

        <Image
          src="/products/run-hero.png"
          width={1920}
          height={991}
          alt="The Nhost Dashboard's Run service page"
          className="relative z-10 mx-auto h-auto w-full animate-slide-middle-up object-contain"
          priority
          sizes="(max-width: 1024px) 50vw, 60vw"
        />

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center justify-center space-x-2 rounded-xl border border-divider bg-paper py-2 px-4 shadow-lg">
            <a
              href="https://tcspovfliddfqpzfloes-5000.svc.eu-central-1.nhost.run/cat"
              target="_blank"
              rel="noreferrer noopener"
              className="z-50 truncate text-sm hover:underline"
            >
              https://tcspovfliddfqpzfloes-5000.svc.eu-central-1.nhost.run/cat
            </a>
            <div className="flex h-6 w-6 items-center ">
              <ArrowLeftIcon className="animate-bounce-right-left text-brand-main" />
            </div>
          </div>

          <CodeSnippet
            language="dockerfile"
            disableGlow
            disableLineGrid
            className="z-20 hidden max-w-sm animate-fade-in-delay shadow-lg md:block"
          >
            {dockerfileExample}
          </CodeSnippet>
        </div>
      </div>
    </Container>
  )
}
