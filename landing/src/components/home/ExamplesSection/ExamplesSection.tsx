import { Button, ButtonProps } from '@/components/common/Button'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { ExampleSelectorButton } from '@/components/common/ExampleSelectorButton'
import { FlutterIcon } from '@/components/common/icons/FlutterIcon'
import { JavaScriptIcon } from '@/components/common/icons/JavaScriptIcon'
import { NextjsIcon } from '@/components/common/icons/NextjsIcon'
import { ReactIcon } from '@/components/common/icons/ReactIcon'
import { VueIcon } from '@/components/common/icons/VueIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import { codeSnippets, Snippets, TechSnippets } from '@/data/codeSnippets'
import Image from 'next/image'
import { useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { twMerge } from 'tailwind-merge'

const codeSnippetLanguageMap: Record<keyof TechSnippets, string> = {
  javascript: 'javascript',
  react: 'tsx',
  nextjs: 'tsx',
  vue: 'tsx',
  flutter: 'dart',
}

function TechnologySelectorButton({
  active,
  className,
  ...props
}: ButtonProps & { active?: boolean }) {
  return (
    <Button
      variant={active ? 'outlined' : 'borderless'}
      size="sm"
      className={twMerge(
        'justify-items-center hover:bg-transparent',
        'grid-flow-row md:grid-flow-col',
        'border-0 md:border',
        'px-0 py-0 md:px-4 md:py-2',
        'text-xs md:text-sm',
        !active && 'text-opacity-65',
        className,
      )}
      {...props}
    />
  )
}

const exampleNumberMap: Record<keyof Snippets, number> = {
  signUp: 1,
  query: 2,
  mutation: 3,
  fileUpload: 4,
}

const technologyNumberMap: Record<keyof TechSnippets, number> = {
  javascript: 1,
  vue: 2,
  react: 3,
  nextjs: 4,
  flutter: 5,
}

export default function ExamplesSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.5 })
  const [activeExample, setActiveExample] = useState<keyof Snippets>('signUp')
  const [activeTechnology, setActiveTechnology] =
    useState<keyof TechSnippets>('javascript')

  const activeSnippet = codeSnippets[activeTechnology][activeExample] || ''
  const activeExampleNumber = exampleNumberMap[activeExample]
  const activeTechnologyNumber = technologyNumberMap[activeTechnology]

  return (
    <Container
      ref={ref}
      component="section"
      slotProps={{ root: { className: 'overflow-hidden xl:overflow-visible' } }}
      className="mt-24 grid grid-flow-row gap-12 pb-12 lg:mt-28 lg:gap-28"
    >
      <SectionHeading
        title="For Developers, By Developers"
        subtitle="Type-safe SDKs for your favorite frameworks. Production-ready code in minutes, not months."
      />

      <div className="z-0 grid items-start gap-14 xl:grid-cols-2 xl:gap-6">
        <div className="order-2 col-span-1 mx-auto hidden w-full max-w-screen-sm md:block xl:order-1 xl:max-w-none">
          <CodeSnippet
            language={codeSnippetLanguageMap[activeTechnology]}
            wrapLongLines={false}
            customStyle={{ minHeight: 240 }}
            slotProps={{ root: { className: 'mx-auto md:max-w-xl' } }}
          >
            {activeSnippet}
          </CodeSnippet>
        </div>

        <div className="order-2 col-span-1 block md:hidden">
          <CodeSnippet
            language={codeSnippetLanguageMap[activeTechnology]}
            wrapLongLines={false}
            customStyle={{ width: 'calc(100vw - 40px)', padding: 16 }}
          >
            {activeSnippet}
          </CodeSnippet>
        </div>

        <div className="order-1 col-span-1 mx-auto grid max-w-2xl grid-flow-row content-start xl:order-2 xl:max-w-none">
          <div className="relative z-20 flex w-full flex-row justify-evenly gap-2 xl:justify-center xl:gap-5">
            <ExampleSelectorButton
              active={activeExample === 'signUp'}
              onClick={() => setActiveExample('signUp')}
            >
              Auth & Sign Up
            </ExampleSelectorButton>

            <ExampleSelectorButton
              active={activeExample === 'query'}
              onClick={() => setActiveExample('query')}
            >
              Realtime Queries
            </ExampleSelectorButton>

            <ExampleSelectorButton
              active={activeExample === 'mutation'}
              onClick={() => setActiveExample('mutation')}
            >
              Data Mutations
            </ExampleSelectorButton>

            <ExampleSelectorButton
              active={activeExample === 'fileUpload'}
              onClick={() => setActiveExample('fileUpload')}
            >
              Storage & Files
            </ExampleSelectorButton>
          </div>

          <div className="relative">
            <div
              className={twMerge(
                'absolute z-10 h-full w-full',
                inView &&
                  `home-example-top-connectors-${activeExampleNumber}-${activeTechnologyNumber}`,
              )}
            >
              <div
                key={`${activeExample}-${activeTechnology}`}
                className={twMerge(
                  'bg-pipe-gradient absolute h-full w-full',
                  inView &&
                    `home-example-top-connectors-${activeExampleNumber}-${activeTechnologyNumber}-animation`,
                )}
              />
            </div>

            <Image
              src="/common/connectors/home-example-top-connectors.svg"
              width={608}
              height={97}
              alt="Dashed lines"
              className="z-0 mx-auto h-auto w-full"
            />
          </div>

          <div className="relative z-20 flex w-full flex-row justify-evenly gap-4 md:justify-center">
            <TechnologySelectorButton
              active={activeTechnology === 'javascript'}
              onClick={() => setActiveTechnology('javascript')}
            >
              <JavaScriptIcon /> JavaScript
            </TechnologySelectorButton>

            <TechnologySelectorButton
              active={activeTechnology === 'vue'}
              onClick={() => setActiveTechnology('vue')}
            >
              <VueIcon /> Vue
            </TechnologySelectorButton>

            <TechnologySelectorButton
              active={activeTechnology === 'react'}
              onClick={() => setActiveTechnology('react')}
            >
              <ReactIcon /> React
            </TechnologySelectorButton>

            <TechnologySelectorButton
              active={activeTechnology === 'nextjs'}
              onClick={() => setActiveTechnology('nextjs')}
            >
              <NextjsIcon /> Next.js
            </TechnologySelectorButton>

            <TechnologySelectorButton
              disabled
              className="opacity-65"
              active={activeTechnology === 'flutter'}
              onClick={() => setActiveTechnology('flutter')}
            >
              <FlutterIcon /> Flutter
            </TechnologySelectorButton>
          </div>

          <div className="relative z-0">
            <div
              className={twMerge(
                'absolute z-0 h-full w-full',
                inView &&
                  `home-example-bottom-connectors-${activeTechnologyNumber}`,
              )}
            >
              <div
                key={`${activeExample}-${activeTechnology}`}
                className={twMerge(
                  'bg-pipe-gradient absolute h-full w-full',
                  inView &&
                    `home-example-bottom-connectors-${activeTechnologyNumber}-animation`,
                )}
              />
            </div>

            <Image
              src="/common/connectors/home-example-bottom-connectors.svg"
              width={608}
              height={66}
              alt="Dashed lines"
              className="z-10 mx-auto hidden h-full w-auto xl:block"
            />

            <Image
              src="/common/logo-glow.svg"
              width={1220}
              height={1220}
              alt="Nhost Logo in a dark circle"
              className="absolute -top-52 left-0 right-0 z-0 mx-auto hidden h-auto w-full object-none xl:block"
            />
          </div>
        </div>
      </div>
    </Container>
  )
}
